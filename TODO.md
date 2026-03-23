# Admin Attendance Dashboard Implementation

## Tasks
- [x] Create `src/app/dashboard/admin/attendance/page.tsx` as a server component
- [x] Implement authentication using `getServerSession(authOptions)`
- [x] Add role check to ensure user is "ADMIN"
- [x] Derive `schoolId` from session securely
- [x] Fetch all classes for the admin's school using `ClassService.getAllClasses({ schoolId })`
- [x] Extract `classId` and `date` from `searchParams`
- [x] Implement conditional fetching of attendance records when `classId` and `date` are provided
- [x] Fetch attendance records with Prisma, filtering by `classId`, `date`, and `schoolId`
- [x] Include related student data in attendance queries
- [x] Calculate attendance summary: total students, present, absent, late
- [x] Render class selector dropdown
- [x] Render date picker input
- [x] Render summary cards for attendance statistics
- [x] Render attendance table or "No attendance recorded" message
- [x] Ensure all data fetching respects school boundaries for security

## Testing
- [ ] Before testing/production: remove hardcoded demo admin credentials from `src/lib/auth.ts`
- [ ] Test page access at `/dashboard/admin/attendance`
- [ ] Verify admin role restriction
- [ ] Verify data is filtered by schoolId from session
- [ ] Test class selection and date filtering
- [ ] Test summary calculations
- [ ] Test attendance table display
- [ ] Test navigation link in admin sidebar
