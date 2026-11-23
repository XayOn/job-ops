import { generateCourse } from "./course-generator";
import { type MoodleCourse, coursesFor, enrol, moodleEnabled } from "./moodle";
import { tududi } from "./tududi";

const day = (d: Date, add: number) => new Date(d.getTime() + add * 86400000).toISOString().slice(0, 10);

export async function trainingPlan(title: string, missing: string[], email: string | null, language = "es") {
  const now = new Date();
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() + ((8 - monday.getUTCDay()) % 7 || 7));
  const notes: string[] = [];
  if (!moodleEnabled()) notes.push("Moodle is not configured: no courses were found or generated.");
  else if (!email) notes.push("No email: sign in with SSO to be enrolled in the courses.");
  const todo = await tududi();
  const taken = todo ? await todo.names() : [];
  const weeks = [];
  for (const [i, skill] of missing.entries()) {
    const week = {
      week: i + 1,
      skill,
      start: day(monday, i * 7),
      due: day(monday, i * 7 + 6),
      course: null as MoodleCourse | null,
      enrolled: false,
      task: false,
    };
    try {
      if (moodleEnabled()) {
        week.course = (await coursesFor(skill))[0] ?? (await generateCourse(skill, language));
        if (email) week.enrolled = !!(await enrol(email, week.course.id));
      }
      const marker = `[jobops-plan:${title}:${week.week}]`;
      if (todo && !taken.some((n) => n.includes(marker))) {
        await todo.create({
          name: `Learn: ${skill} (${title}) ${marker}`,
          note: week.course?.url ?? "",
          due_date: week.due,
        });
        week.task = true;
      }
    } catch (e) {
      notes.push(`Week ${week.week} (${skill}): ${e instanceof Error ? e.message : String(e)}`);
    }
    weeks.push(week);
  }
  if (!todo) notes.push("Tududi is not configured: no tasks were created.");
  return { title, weeks, notes };
}
