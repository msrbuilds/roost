DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM _realtime.tenants WHERE external_id = 'realtime-dev') THEN
    ALTER TABLE _realtime.extensions DROP CONSTRAINT IF EXISTS extensions_tenant_external_id_fkey;
    UPDATE _realtime.tenants SET external_id = 'realtime', name = 'realtime' WHERE external_id = 'realtime-dev';
    UPDATE _realtime.extensions SET tenant_external_id = 'realtime' WHERE tenant_external_id = 'realtime-dev';
    ALTER TABLE _realtime.extensions ADD CONSTRAINT extensions_tenant_external_id_fkey FOREIGN KEY (tenant_external_id) REFERENCES _realtime.tenants(external_id);
    RAISE NOTICE 'Tenant renamed to realtime';
  ELSE
    RAISE NOTICE 'Tenant already correct or not yet seeded';
  END IF;
END
$$;
