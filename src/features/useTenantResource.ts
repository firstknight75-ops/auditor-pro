// apps/web/src/hooks/useTenantResource.ts



import { useCallback, useEffect, useRef, useState } from "react";
import { getActiveCompanyId } from "./active-company";

export const SECURE_LOADING_MESSAGE =
  "جاري التحقق من الصلاحيات وتأمين RLS لجلسة الشركة الحالية...";

export function useTenantResource<T>(
  path: string,
  fallback: (companyId: string) => T,
) {
  const [data, setData] = useState<T | undefined>();
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const token = useRef(0);

  const load = useCallback(async () => {
    const currentCompany = getActiveCompanyId();
    const currentToken = ++token.current;

    setCompanyId(currentCompany);
    setLoading(true);
    setUsingMock(false);

    try {
      const res = await fetch(path, {
        headers: {
          "x-active-company-id": currentCompany,
        },
      });

      if (!res.ok) throw new Error(`API ${res.status}`);

      const json = (await res.json()) as T;
      if (token.current === currentToken) setData(json);
    } catch {
      if (token.current === currentToken) {
        setData(fallback(currentCompany));
        setUsingMock(true);
      }
    } finally {
      if (token.current === currentToken) setLoading(false);
    }
  }, [fallback, path]);

  useEffect(() => {
    load();

    const onChange = () => {
      // Zero-residue switching.
      setData(undefined);
      setLoading(true);
      setCompanyId(getActiveCompanyId());
      load();
    };

    window.addEventListener("auditcore.active_company_changed", onChange);
    return () =>
      window.removeEventListener("auditcore.active_company_changed", onChange);
  }, [load]);

  return {
    data,
    loading,
    usingMock,
    companyId,
    reload: load,
  };
}