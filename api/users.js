// POST /api/users { op, … }  →  account management for admins
//   create { name, email, role, phone, idNumber, photo, password, links }
//   update { id, patch }        (profile fields, role, status, links)
//   delete { ids }
//   resetLink { id }            → one-time reset token for the admin to pass on
import { createResetToken, currentUser, endAllSessions, newSecret, passwordProblems, publicUser } from "./_lib/auth.js";
import { HttpError, bad, context, deny } from "./_lib/access.js";
import { email, emailFree, links, newUserId, photo, text } from "./_lib/accounts.js";
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
      const e = email(body.email);
      await emailFree(db, e);
      const problems = passwordProblems(body.password);
      if (problems.length) bad(`Temporary password needs ${problems.join(", ")}.`);
      const doc = {
        _id: newUserId(), name, email: e, role, status: "active",
        phone: text(body.phone, 40, "Phone"), idNumber: text(body.idNumber, 40, "ID number"), photo: photo(body.photo),
        createdAt: new Date().toISOString().slice(0, 10), lastLogin: null,
        ...(await links(db, role, body.links)), ...newSecret(body.password),
      };
      await users.insertOne(doc);
      return { user: publicUser(doc) };
    }

    case "update": {
      const target = await users.findOne({ _id: String(body.id || "") });
      mayManage(target);
      const p = body.patch && typeof body.patch === "object" ? body.patch : bad("Invalid change.");
      const set = {};
      if ("name" in p) { set.name = text(p.name, 100, "Name"); if (!set.name) bad("Enter a full name."); }
      if ("email" in p) { set.email = email(p.email); await emailFree(db, set.email, target._id); }
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
        }));
      }
      if (Object.keys(set).length) await users.updateOne({ _id: target._id }, { $set: set });
      if (set.status && set.status !== "active") await endAllSessions(target._id); // deactivated: signed out everywhere
      return { user: publicUser({ ...target, ...set }) };
    }

    case "delete": {
      const ids = [].concat(body.ids).map(String);
      if (!ids.length || ids.length > 500) bad("Choose between 1 and 500 accounts.");
      const targets = await users.find({ _id: { $in: ids } }).toArray();
      targets.forEach(mayManage);
      await users.deleteMany({ _id: { $in: targets.map((t) => t._id) } });
      for (const t of targets) await endAllSessions(t._id);
      return {};
    }

    case "resetLink": {
      const target = await users.findOne({ _id: String(body.id || "") });
      mayManage(target);
      if (target.status !== "active") return { token: null };
      return { token: await createResetToken(target) };
    }

    default:
      return bad("Unknown operation.");
  }
}, { limit: 600 * 1024 });
