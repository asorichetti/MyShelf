import { useCallback, useEffect, useRef, useState } from 'react';

import { loansRepo, useDatabase } from '@/db';
import { loanStatus, today as todayOf, type IsoDate, type LoanStatus, type LoanWithDetails } from '@/domain';
import { useLibraryEvent } from '@/features/events';

const RANK: Record<LoanStatus, number> = { overdue: 0, 'due-soon': 1, 'on-loan': 2, returned: 3 };

/**
 * Out-now order: overdue first (most overdue at the top), then by due date,
 * soonest first; loans without a due date last, oldest loan first.
 */
export function sortOutNow(loans: readonly LoanWithDetails[], today: IsoDate): LoanWithDetails[] {
  return [...loans].sort((a, b) => {
    const rank = RANK[loanStatus(a, today)] - RANK[loanStatus(b, today)];
    if (rank) return rank;
    // YYYY-MM-DD sorts as text, and a corrupt date then sorts somewhere instead of throwing.
    if (a.dueOn && b.dueOn && a.dueOn !== b.dueOn) return a.dueOn < b.dueOn ? -1 : 1;
    if (a.dueOn && !b.dueOn) return -1;
    if (!a.dueOn && b.dueOn) return 1;
    return a.lentOn === b.lentOn ? a.id - b.id : a.lentOn < b.lentOn ? -1 : 1;
  });
}

export interface LoansState {
  /** Null until first loaded. */
  out: LoanWithDetails[] | null;
  history: LoanWithDetails[] | null;
  overdueCount: number;
  today: IsoDate;
  reload: () => void;
}

/** The Loans tab's lists; reloads when loans or the library change. */
export function useLoans(): LoansState {
  const db = useDatabase();
  const [out, setOut] = useState<LoanWithDetails[] | null>(null);
  const [history, setHistory] = useState<LoanWithDetails[] | null>(null);
  const [version, setVersion] = useState(0);
  const request = useRef(0);
  const today = todayOf();

  useEffect(() => {
    const id = ++request.current;
    Promise.all([loansRepo.listOpenLoans(db), loansRepo.listReturnedLoans(db)])
      .then(([open, returned]) => {
        if (id !== request.current) return;
        setOut(sortOutNow(open, today));
        setHistory(returned);
      })
      .catch((e) => console.error('Could not load the loans', e));
  }, [db, today, version]);
  useEffect(() => () => void request.current++, []);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useLibraryEvent(['loans-changed', 'library-changed'], reload);
  const overdueCount = out?.filter((l) => loanStatus(l, today) === 'overdue').length ?? 0;
  return { out, history, overdueCount, today, reload };
}

/** Open loans past their due date, for the Loans tab badge. */
export function useOverdueCount(): number {
  const db = useDatabase();
  const [count, setCount] = useState(0);
  const [version, setVersion] = useState(0);
  const today = todayOf();
  useEffect(() => {
    let active = true;
    loansRepo
      .countOverdueLoans(db, today)
      .then((n) => active && setCount(n))
      .catch((e) => console.error('Could not count overdue loans', e));
    return () => {
      active = false;
    };
  }, [db, today, version]);
  useLibraryEvent(['loans-changed', 'library-changed'], () => setVersion((v) => v + 1));
  return count;
}
