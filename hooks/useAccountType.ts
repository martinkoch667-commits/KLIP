"use client";

import { useState, useEffect } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

type AccountType = "solo" | "agency" | null;

export function useAccountType() {
  const supabase = createClientComponentClient();
  const [accountType, setAccountType] = useState<AccountType>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) { setLoading(false); return; }
        const { data } = await supabase
          .from("user_settings")
          .select("account_type")
          .eq("user_id", session.user.id)
          .maybeSingle();
        setAccountType((data?.account_type as AccountType) ?? null);
      } catch {
        // silently fail — treat as null
      } finally {
        setLoading(false);
      }
    })();
  }, [supabase]);

  return {
    accountType,
    loading,
    isAgency: accountType === "agency",
    isSolo: accountType === "solo",
  };
}
