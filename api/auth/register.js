// POST /api/auth/register { name, email, role, password, phone, idNumber }
// Creates a *pending* account; a school admin must approve it before it can sign in.
import { newSecret, passwordProblems } from "../_lib/auth.js";
import { bad } from "../_lib/access.js";
import { email, emailFree, links, newUserId, text } from "../_lib/accounts.js";
import { getDb } from "../_lib/db.js";
import { postRoute } from "../_lib/route.js";

const SELF_REGISTER_ROLES = ["student", "parent", "teacher"];

export default postRoute(async (body) => {
  const db = await getDb();
  if (!SELF_REGISTER_ROLES.includes(body.role)) bad("Choose Student, Parent or Teacher.");
  const name = text(body.name, 100, "Name");
  if (!name) bad("Enter a full name.");
  const e = email(body.email);
  await emailFree(db, e);
  const problems = passwordProblems(body.password);
  if (problems.length) bad(`Password needs ${problems.join(", ")}.`);
  const id = text(body.idNumber, 40, "ID number").toUpperCase();
  const link = !id ? {} : body.role === "teacher" ? { teacherId: id } : body.role === "student" ? { studentId: id } : { childIds: [id] };
  await db.collection("users").insertOne({
    _id: newUserId(), name, email: e, role: body.role, status: "pending",
    phone: text(body.phone, 40, "Phone"), idNumber: id, photo: null,
    createdAt: new Date().toISOString().slice(0, 10), lastLogin: null, note: "Self-registered",
    ...(await links(db, body.role, link)), ...newSecret(body.password),
  });
  return {};
});
