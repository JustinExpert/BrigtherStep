// POST /api/users { op, … }  →  account management for admins
//   create { name, email, role, phone, idNumber, photo, password, links }
//   update { id, patch }        (profile fields, role, status, links)
//   delete { ids }
//   resetLink { id }            → one-time reset token for the admin to pass on
//   tempPassword { id, password } → new temporary password; the person must change it at next sign-in
//   studentLogins { studentId, student: { email? } | null, parent: { name, email } | { id } | null }
//                               → the student's and/or a parent's login, with generated temporary passwords
// Accounts made or reset here start on a temporary password (mustChangePassword): until the person
// sets their own, they can only sign in to change it.
import { createResetToken, currentUser, endAllSessions, lockKey, newSecret, passwordProblems, publicUser } from "./_lib/auth.js";
import { HttpError, bad, context, deny } from "./_lib/access.js";
import { accountEmail, email, emailFree, links, newUserId, photo, readablePassword, text } from "./_lib/accounts.js";
import { postRoute } from "./_lib/route.js";
import { ROLES } from "../src/lib/permissions.js";

const STATUSES = ["active", "pending", "inactive"];
/** Roles an admin may create or manage: the Super Admin all, a School Admin only teachers, students and parents. */
const manageable = (role) => (role === "superadmin" ? ROLES.map((r) => r.key) : ["teacher", "student", "parent"]);

export default postRoute(async (body, req) => {
  const me = await currentUser(req);
  if (!me) throw new HttpError(401, "Your session has ended. Please sign in again.");
  const { db, can } = await context(me);
  if (!can("users", "edit")) deny();
  const users = db.collection("users");
  const mayManage = (u) => {
    if (!u) throw new HttpError(404, "That account no longer exists.");
    if (u._id === me._id) deny("Use Account settings to change your own account.");
    if (!manageable(me.role).includes(u.role)) deny("Only the Super Admin can manage that account.");
  };
  const checkRole = (role) => { if (!manageable(me.role).includes(role)) deny("You can't give an account that role."); return role; };

  switch (body.op) {
    case "create": {
      const role = checkRole(body.role);
      const name = text(body.name, 100, "Name");
      if (!name) bad("Enter a full name.");
      const linked = await links(db, role, body.links);
      const e = accountEmail(body.email, role, linked.studentId);
      if (e) await emailFree(db, e);
      const problems = passwordProblems(body.password);
      if (problems.length) bad(`Temporary password needs ${problems.join(", ")}.`);
      const doc = {
        _id: newUserId(), name, ...(e && { email: e }), role, status: "active",
        phone: text(body.phone, 40, "Phone"), idNumber: text(body.idNumber, 40, "ID number"), photo: photo(body.photo),
        createdAt: new Date().toISOString().slice(0, 10), lastLogin: null, mustChangePassword: true,
        ...linked, ...newSecret(body.password),
      };
      await users.insertOne(doc);
      return { user: publicUser(doc) };
    }

    case "update": {
      const target = await users.findOne({ _id: String(body.id || "") });
      mayManage(target);
      const p = body.patch && typeof body.patch === "object" ? body.patch : bad("Invalid change.");
      const set = {}, unset = {};
      if ("name" in p) { set.name = text(p.name, 100, "Name"); if (!set.name) bad("Enter a full name."); }
      if ("phone" in p) set.phone = text(p.phone, 40, "Phone");
      if ("idNumber" in p) set.idNumber = text(p.idNumber, 40, "ID number");
      if ("note" in p) set.note = text(p.note, 200, "Note");
      if ("photo" in p) set.photo = photo(p.photo);
      if ("role" in p) set.role = checkRole(p.role);
      if ("status" in p) { if (!STATUSES.includes(p.status)) bad("Invalid status."); set.status = p.status; }
      const role = set.role || target.role;
      if (["studentId", "teacherId", "childIds", "role"].some((k) => k in p)) {
        Object.assign(set, await links(db, role, {
          studentId: "studentId" in p ? p.studentId : target.studentId,
          teacherId: "teacherId" in p ? p.teacherId : target.teacherId,
          childIds: "childIds" in p ? p.childIds : target.childIds,
        }, target._id));
      }
      // Email last: whether one is needed depends on the role and the student link.
      const studentId = "studentId" in set ? set.studentId : target.studentId;
      if ("email" in p || "role" in p || "studentId" in p) {
        const e = accountEmail("email" in p ? p.email : target.email, role, studentId);
        if (e && e !== target.email) { await emailFree(db, e, target._id); set.email = e; }
        if (!e && target.email) unset.email = "";
      }
      const change = { ...(Object.keys(set).length && { $set: set }), ...(Object.keys(unset).length && { $unset: unset }) };
      if (Object.keys(change).length) await users.updateOne({ _id: target._id }, change);
      if (set.status && set.status !== "active") await endAllSessions(target._id); // deactivated: signed out everywhere
      const after = { ...target, ...set };
      if (unset.email) delete after.email;
      return { user: publicUser(after) };
    }

    case "delete": {
      const ids = [].concat(body.ids).map(String);
      if (!ids.length || ids.length > 500) bad("Choose between 1 and 500 accounts.");
      const targets = await users.find({ _id: { $in: ids } }).toArray();
      targets.forEach(mayManage);
      const gone = targets.map((t) => t._id);
      await Promise.all([users.deleteMany({ _id: { $in: gone } }), db.collection("sessions").deleteMany({ userId: { $in: gone } })]);
      return {};
    }

    case "resetLink": {
      const target = await users.findOne({ _id: String(body.id || "") });
      mayManage(target);
      if (target.status !== "active") return { token: null };
      return { token: await createResetToken(target) };
    }

    case "tempPassword": {
      const target = await users.findOne({ _id: String(body.id || "") });
      mayManage(target);
      const problems = passwordProblems(body.password);
      if (problems.length) bad(`Temporary password needs ${problems.join(", ")}.`);
      await users.updateOne({ _id: target._id }, {
        $set: { ...newSecret(body.password), mustChangePassword: true },
        $unset: { resetTokenHash: "", resetExpires: "" },
      });
      await endAllSessions(target._id); // the old password's sessions end
      await db.collection("login_attempts").deleteOne({ _id: lockKey(target) }); // and any lockout
      return { user: publicUser({ ...target, mustChangePassword: true }) };
    }

    case "studentLogins": {
      // At enrolment: the student's own login and/or a parent login, in one step.
      // The server picks the temporary passwords and returns them once, for the printed slip.
      const student = await db.collection("students").findOne({ _id: String(body.studentId || "") }, { projection: { name: 1 } });
      if (!student) bad("That student record no longer exists.");
      const stamp = { status: "active", phone: "", photo: null, createdAt: new Date().toISOString().slice(0, 10), lastLogin: null, mustChangePassword: true };
      const out = {};
      const inserts = [];

      if (body.student) {
        const linked = await links(db, "student", { studentId: student._id }); // refuses if they already have one
        const e = accountEmail(body.student.email, "student", student._id);
        if (e) await emailFree(db, e);
        const password = readablePassword();
        const doc = { _id: newUserId(), name: student.name, ...(e && { email: e }), role: "student", idNumber: student._id, ...stamp, ...linked, ...newSecret(password) };
        inserts.push(doc);
        out.student = { user: publicUser(doc), signIn: e || student._id, password };
      }

      let addChildTo = null;
      if (body.parent?.id) { // an existing parent account (e.g. a sibling's) gets this child too
        const parent = await users.findOne({ _id: String(body.parent.id) });
        mayManage(parent);
        if (parent.role !== "parent") bad("That account isn't a parent account.");
        addChildTo = parent;
        out.parent = { user: publicUser({ ...parent, childIds: [...new Set([...(parent.childIds || []), student._id])] }), signIn: parent.email, password: null };
      } else if (body.parent) {
        const name = text(body.parent.name, 100, "Parent's name");
        if (!name) bad("Enter the parent's full name.");
        const e = email(body.parent.email); // parents sign in with their email
        if (inserts.some((d) => d.email === e)) bad("The student and the parent need different emails.");
        await emailFree(db, e);
        const password = readablePassword();
        const doc = { _id: newUserId(), name, email: e, role: "parent", idNumber: "", ...stamp, studentId: null, teacherId: null, childIds: [student._id], ...newSecret(password) };
        inserts.push(doc);
        out.parent = { user: publicUser(doc), signIn: e, password };
      }
      if (!out.student && !out.parent) bad("Choose a student account, a parent account, or both.");

      if (inserts.length) await users.insertMany(inserts);
      if (addChildTo) await users.updateOne({ _id: addChildTo._id }, { $addToSet: { childIds: student._id } });
      return out;
    }

    default:
      return bad("Unknown operation.");
  }
}, { limit: 600 * 1024 });
