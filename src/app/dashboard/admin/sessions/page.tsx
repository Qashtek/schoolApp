import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { SessionService } from '@/lib/services/session.service';
import { FlashSuccess } from './flash-success';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

function formatDate(date: Date): string {
  return dateFormatter.format(new Date(date));
}

async function activateSessionAction(formData: FormData) {
  'use server';

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  if (!session.user.schoolId) {
    redirect('/login');
  }

  const sessionId = String(formData.get('sessionId') ?? '').trim();
  if (!sessionId) {
    return;
  }

  const sessionService = new SessionService({
    id: session.user.id,
    email: session.user.email ?? '',
    name: session.user.name,
    role: session.user.role,
    schoolId: session.user.schoolId,
  });

  await sessionService.setActiveSession(sessionId);
  revalidatePath('/dashboard/admin/sessions');
}

async function activateTermAction(formData: FormData) {
  'use server';

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  if (!session.user.schoolId) {
    redirect('/login');
  }

  const sessionId = String(formData.get('sessionId') ?? '').trim();
  const termId = String(formData.get('termId') ?? '').trim();

  if (!sessionId || !termId) {
    return;
  }

  const sessionService = new SessionService({
    id: session.user.id,
    email: session.user.email ?? '',
    name: session.user.name,
    role: session.user.role,
    schoolId: session.user.schoolId,
  });

  const terms = await sessionService.getTermsForSession(sessionId);
  const termInSession = terms.find((term) => term.id === termId);

  if (!termInSession) {
    return;
  }

  await sessionService.setActiveTerm(termId);
  revalidatePath('/dashboard/admin/sessions');
}

async function deleteSessionAction(formData: FormData) {
  'use server';

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  if (!session.user.schoolId) {
    redirect('/login');
  }

  const sessionId = String(formData.get('sessionId') ?? '').trim();
  if (!sessionId) {
    return;
  }

  const sessionService = new SessionService({
    id: session.user.id,
    email: session.user.email ?? '',
    name: session.user.name,
    role: session.user.role,
    schoolId: session.user.schoolId,
  });

  await sessionService.deleteSession(sessionId);
  revalidatePath('/dashboard/admin/sessions');
}

async function deleteTermAction(formData: FormData) {
  'use server';

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  if (!session.user.schoolId) {
    redirect('/login');
  }

  const sessionId = String(formData.get('sessionId') ?? '').trim();
  const termId = String(formData.get('termId') ?? '').trim();

  if (!sessionId || !termId) {
    return;
  }

  const sessionService = new SessionService({
    id: session.user.id,
    email: session.user.email ?? '',
    name: session.user.name,
    role: session.user.role,
    schoolId: session.user.schoolId,
  });

  await sessionService.deleteTerm(sessionId, termId);
  revalidatePath('/dashboard/admin/sessions');
}

export default async function AdminSessionsPage({
  searchParams,
}: {
  searchParams?: { created?: string; termCreated?: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  if (!session.user.schoolId) {
    redirect('/login');
  }

  const sessionService = new SessionService({
    id: session.user.id,
    email: session.user.email ?? '',
    name: session.user.name,
    role: session.user.role,
    schoolId: session.user.schoolId,
  });

  const sessions = await sessionService.getAllSessions();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Academic Sessions</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage sessions and terms for your school calendar.
          </p>
        </div>
        <Link
          href="/dashboard/admin/sessions/new"
          className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Create New Session
        </Link>
      </div>

      {searchParams?.created === '1' && (
        <FlashSuccess
          message="Academic session created successfully."
          queryKey="created"
        />
      )}

      {searchParams?.termCreated === '1' && (
        <FlashSuccess
          message="Term created successfully."
          queryKey="termCreated"
        />
      )}

      {sessions.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
          No academic sessions found.
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((academicSession) => (
            <section
              key={academicSession.id}
              className={`rounded-lg border p-5 shadow-sm ${
                academicSession.isActive
                  ? 'border-emerald-300 bg-emerald-50/30'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-gray-900">{academicSession.name}</h2>
                  {academicSession.isActive && (
                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      Active
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <form action={activateSessionAction}>
                    <input type="hidden" name="sessionId" value={academicSession.id} />
                    <button
                      type="submit"
                      disabled={academicSession.isActive}
                      className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {academicSession.isActive ? 'Current Active Session' : 'Set As Active'}
                    </button>
                  </form>

                  <Link
                    href={`/dashboard/admin/sessions/${academicSession.id}/terms/new`}
                    className="inline-flex items-center rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Add Term
                  </Link>

                  <form action={deleteSessionAction}>
                    <input type="hidden" name="sessionId" value={academicSession.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                    >
                      Delete Session
                    </button>
                  </form>
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-800">Terms</h3>
                {academicSession.terms.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">No terms added yet.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {academicSession.terms.map((term) => (
                      <li
                        key={term.id}
                        className={`flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 ${
                          term.isActive
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-gray-100 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{term.name}</span>
                          {term.isActive && (
                            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
                              Active Term
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-gray-600">
                            {formatDate(term.startDate)} - {formatDate(term.endDate)}
                          </span>

                          <form action={activateTermAction}>
                            <input type="hidden" name="sessionId" value={academicSession.id} />
                            <input type="hidden" name="termId" value={term.id} />
                            <button
                              type="submit"
                              disabled={term.isActive}
                              className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {term.isActive ? 'Current Active' : 'Set Active'}
                            </button>
                          </form>

                          <form action={deleteTermAction}>
                            <input type="hidden" name="sessionId" value={academicSession.id} />
                            <input type="hidden" name="termId" value={term.id} />
                            <button
                              type="submit"
                              className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                            >
                              Delete
                            </button>
                          </form>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
