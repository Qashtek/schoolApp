# Maintenance Scripts

This folder contains one-off / on-demand database maintenance scripts. They are
**not** part of the application runtime — run them manually against the local
dev database when needed.

> ⚠️ Always back up the database before running a write script:
> `cp prisma/dev.db prisma/dev.db.bak`

---

## `backfill-class-subjects.ts`

Creates missing `class_subjects` rows from existing `SUBJECT_TEACHER`
assignments.

### Background

When a teacher is assigned as a subject teacher, the assignment lives in
`teacher_class_subjects`. The subject should *also* be linked to the class
through `class_subjects`, which the grade entry page, class/subject detail
pages, and report cards rely on. Older data may have teacher assignments
without the corresponding `class_subjects` link (this was fixed in
`TeacherService.assignSubjectTeacher`, so new assignments are safe).

### When to re-run

Only needed if the data drift reappears, e.g. after importing legacy data or
restoring an old database dump. Safe to re-run at any time — it is idempotent
and skips pairs that are already linked.

### Run

```bash
npx ts-node --project tsconfig.seed.json scripts/backfill-class-subjects.ts
```

Expected output: `Backfill complete: 0 class_subjects created, N already linked.`
