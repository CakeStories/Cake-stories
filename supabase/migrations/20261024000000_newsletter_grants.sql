-- The footer sign-up writes through the server (service role); it had no table privileges.
grant select, insert, update, delete on public.newsletter_subscribers to service_role;
