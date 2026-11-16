// POST /api/auth/reset { op: "request", email }            →  starts a password reset
// POST /api/auth/reset { op: "confirm", token, password }  →  sets the new password
//
// There is no email service yet. The reset link is only returned in the response when
// DEMO_RESET_LINKS=true (the demo mailbox); otherwise an admin sends it from User Management.
import { createResetToken, normEmail, passwordProblems, setPassword, userForResetToken } from "../_lib/auth.js";
import { bad } from "../_lib/access.js";
import { getDb } from "../_lib/db.js";
import { postRoute } from "../_lib/route.js";

export default postRoute(async (body) => {
  if (body.op === "request") {
    const e = normEmail(body.email);
    if (!e || e.length > 254) bad("Enter your account email.");
    const db = await getDb();
    const user = await db.collection("users").findOne({ email: e });
    // Same reply whether or not the account exists, so emails can't be discovered.
    if (!user || user.status !== "active") return { demoToken: null };
    const token = await createResetToken(user);
    return { demoToken: process.env.DEMO_RESET_LINKS === "true" ? token : null };
  }
  if (body.op === "confirm") {
    const user = await userForResetToken(body.token);
    if (!user) bad("This reset link is invalid or has expired. Please request a new one.");
    const problems = passwordProblems(body.password);
    if (problems.length) bad(`Password needs ${problems.join(", ")}.`);
    await setPassword(null, user, body.password); // also signs the account out everywhere
    return { email: user.email };
  }
  return bad("Unknown operation.");
});
