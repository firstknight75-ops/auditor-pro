// Real-data hook for tenant-scoped server-function calls.
// Replaces the old fetch + mock-fallback pattern. Each call goes through
// TanStack Start's createServerFn() RPC bridge and is scoped to the
// currently-active company via active-company.ts.

import { useCallback, useEffect, useRef, useState } from "react";
import { getActiveCompanyId } from "./active-company";

export const SECURE_LOADING_MESSAGE =
  "جاري التحقق من الصلاحيات وتأمين RLS لجلسة الشركة الحالية...";

export type ServerFn<TArgs extends Record<string, unknown>, TResult> = (
  args: { data: TArgs },
) => Promise<TResult>;

export interface TenantResourceState<T> {
  data: T | undefined;
  loading: boolean;
  error: unknown;
  companyId: string;
  reload: () => Promise<void>;
}

export function useTenantResource<TArgs extends Record<string, unknown>, TResult>(
  fn: ServerFn<TArgs, TResult>,
  args: TArgs,
  deps: ReadonlyArray<unknown> = [],
): TenantResourceState<TResult> {
  const [data, setData] = useState<TResult | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const [companyId, setCompanyId] = useState("");
  const token = useRef(0);

  const run = useCallback(async () => {
    const currentCompany = getActiveCompanyId();
    const currentToken = ++token.current;

    setCompanyId(currentCompany);
    setLoading(true);
    setError(undefined);

    try {
      const merged = { ...args, companyId: currentCompany || args.companyId } as TArgs;
      const result = await fn({ data: merged });
      if (token.current === currentToken) setData(result);
    } catch (err) {
      if (token.current === currentToken) setError(err);
    } finally {
      if (token.current === currentToken) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();

    const onChange = () => {
      // Zero-residue company switching: drop stale data before reloading.
      setData(undefined);
      setLoading(true);
      setCompanyId(getActiveCompanyId());
      run();
    };

    window.addEventListener("auditcore.active_company_changed", onChange);
    return () => window.removeEventListener("auditcore.active_company_changed", onChange);
  }, [run]);

  return { data, loading, error, companyId, reload: run };
}
