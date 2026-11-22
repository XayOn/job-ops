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

const upload = async (name: string, html: string) => {
  const form = new FormData();
  form.append("file_1", new Blob([html], { type: "text/html" }), name);
  const r = await (
    await fetch(`${url()}/webservice/upload.php?token=${process.env.MOODLE_TOKEN}`, { method: "POST", body: form })
  ).json();
  if (!r?.[0]?.itemid) throw new Error("Moodle upload failed");
  return String(r[0].itemid);
};

export type GeneratedCourse = { title: string; summary: string; lessons: { title: string; html: string }[] };

export async function publishCourse(c: GeneratedCourse): Promise<MoodleCourse> {
  const [{ id }] = await ws("core_course_create_courses", {
    "courses[0][fullname]": c.title,
    "courses[0][shortname]": `${c.title.slice(0, 40)}-${Date.now()}`,
    "courses[0][categoryid]": "1",
    "courses[0][summary]": c.summary,
    "courses[0][numsections]": "0",
  });
  for (const [i, l] of c.lessons.entries()) {
    await ws("local_course_add_new_section", {
      courseid: String(id),
      sectionname: l.title,
      sectionnum: String(i + 1),
    });
    await ws("local_course_add_new_course_module_resource", {
      courseid: String(id),
      sectionnum: String(i + 1),
      itemid: await upload(`leccion-${i + 1}.html`, `<meta charset="utf-8"><h1>${l.title}</h1>${l.html}`),
      displayname: l.title,
      visible: "1",
    });
  }
  return { id, name: c.title, url: `${url()}/course/view.php?id=${id}` };
}

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
