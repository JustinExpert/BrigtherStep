// POST /api/auth/profile { name?, phone?, idNumber?, photo? }  →  the signed-in user edits their own profile
import { currentUser, publicUser } from "../_lib/auth.js";
import { HttpError, bad } from "../_lib/access.js";
import { photo, text } from "../_lib/accounts.js";
import { getDb } from "../_lib/db.js";
import { postRoute } from "../_lib/route.js";

export default postRoute(async (body, req) => {
  const user = await currentUser(req);
  if (!user) throw new HttpError(401, "Your session has ended. Please sign in again.");
  const set = {};
  if ("name" in body) { set.name = text(body.name, 100, "Name"); if (!set.name) bad("Name can't be empty."); }
  if ("phone" in body) set.phone = text(body.phone, 40, "Phone");
  if ("idNumber" in body) set.idNumber = text(body.idNumber, 40, "ID number");
  if ("photo" in body) set.photo = photo(body.photo);
  if (Object.keys(set).length) await (await getDb()).collection("users").updateOne({ _id: user._id }, { $set: set });
  return { user: publicUser({ ...user, ...set }) };
}, { limit: 600 * 1024 });
