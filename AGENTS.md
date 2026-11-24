<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

Use Turso through the web libsql client with server-only TURSO_DATABASE_URL and TURSO_AUTH_TOKEN read at request time; local file URLs and native Node drivers cannot run on the hosting runtime.
Await every database read/write and initialization before returning an RPC result; Turso operations are asynchronous.
Demo seeding on Turso is opt-in via AUDITCORE_SEED=true; never populate a customer's database implicitly.
