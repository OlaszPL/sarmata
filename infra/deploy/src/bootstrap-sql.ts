/** First office and its admin, created by the installer (docs/funkcjonalnosci.md, konta i logowanie). */
export interface BootstrapAccount {
  readonly officeName: string;
  readonly email: string;
  readonly password: string;
  readonly firstName: string;
  readonly lastName: string;
}

export const sqlLiteral = (value: string): string => `'${value.replaceAll("'", "''")}'`;

/** Session setting that carries the password from the first statement to the second. */
const PASSWORD_SETTING = 'sarmata.bootstrap_password';

/**
 * Idempotent: does nothing when an admin membership exists. The account comes from
 * access.create_account (migration 20261121140000). The password sits only in a set_config call,
 * which cannot fail, so the statement Postgres logs on an error never contains it. An empty select
 * list keeps psql from printing the value.
 */
export function renderBootstrapSql(account: BootstrapAccount): string {
  const values: string[] = [account.officeName, account.email, account.firstName, account.lastName];
  let tag = '$bootstrap$';
  // The block is dollar-quoted, so no value may contain the tag.
  while (values.some((value) => value.includes(tag))) tag = `$${tag.slice(1, -1)}_x$`;
  return `-- First office and admin account, created once by the installer.
select from set_config('${PASSWORD_SETTING}', ${sqlLiteral(account.password)}, false);
do ${tag}
declare
  new_office uuid;
begin
  if exists (select 1 from public.memberships where role = 'admin') then
    raise notice 'office already initialised, skipping';
    return;
  end if;

  insert into public.offices (name) values (${sqlLiteral(account.officeName)}) returning id into new_office;

  perform access.create_account(
    email => ${sqlLiteral(account.email)},
    password => current_setting('${PASSWORD_SETTING}'),
    office_id => new_office,
    role => 'admin',
    first_name => ${sqlLiteral(account.firstName)},
    last_name => ${sqlLiteral(account.lastName)}
  );
end
${tag};
select from set_config('${PASSWORD_SETTING}', '', false);
`;
}
