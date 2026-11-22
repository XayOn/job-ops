const url = () => process.env.MOODLE_URL?.replace(/\/$/, "");

export const moodleEnabled = () => !!url() && !!process.env.MOODLE_TOKEN;

const ws = async (fn: string, params: Record<string, string>) => {
  const body = new URLSearchParams({
    wstoken: process.env.MOODLE_TOKEN ?? "",
    wsfunction: fn,
    moodlewsrestformat: "json",
    ...params,
  });
  const r = await (await fetch(`${url()}/webservice/rest/server.php`, { method: "POST", body })).json();
  if (r?.exception) throw new Error(`Moodle ${fn}: ${r.message}`);
  return r;
};

export type MoodleCourse = { id: number; name: string; url: string };

export async function coursesFor(skill: string): Promise<MoodleCourse[]> {
  if (!moodleEnabled()) return [];
  const r = await ws("core_course_search_courses", { criterianame: "search", criteriavalue: skill, perpage: "3" });
  return (r.courses ?? []).map((c: any) => ({
    id: c.id,
    name: c.fullname,
    url: `${url()}/course/view.php?id=${c.id}`,
  }));
}

export async function enrol(email: string, courseId: number) {
  const [user] = await ws("core_user_get_users_by_field", { field: "email", "values[0]": email });
  if (!user) throw new Error("Sign in to Moodle once first");
  await ws("enrol_manual_enrol_users", {
    "enrolments[0][roleid]": "5",
    "enrolments[0][userid]": String(user.id),
    "enrolments[0][courseid]": String(courseId),
  });
  return { courseId, userId: user.id };
}
