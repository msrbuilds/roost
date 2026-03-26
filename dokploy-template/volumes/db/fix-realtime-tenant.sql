DO $$
BEGIN
  -- If both exist, delete the dev one (keep the correctly named one)
  IF EXISTS (SELECT 1 FROM _realtime.tenants WHERE external_id = 'realtime')
     AND EXISTS (SELECT 1 FROM _realtime.tenants WHERE external_id = 'realtime-dev') THEN
    DELETE FROM _realtime.extensions WHERE tenant_external_id = 'realtime-dev';
    DELETE FROM _realtime.tenants WHERE external_id = 'realtime-dev';
    RAISE NOTICE 'Deleted duplicate realtime-dev tenant';

  -- If only realtime-dev exists, rename it
  ELSIF EXISTS (SELECT 1 FROM _realtime.tenants WHERE external_id = 'realtime-dev') THEN
    ALTER TABLE _realtime.extensions DROP CONSTRAINT IF EXISTS extensions_tenant_external_id_fkey;
    UPDATE _realtime.tenants SET external_id = 'realtime', name = 'realtime' WHERE external_id = 'realtime-dev';
    UPDATE _realtime.extensions SET tenant_external_id = 'realtime' WHERE tenant_external_id = 'realtime-dev';
    ALTER TABLE _realtime.extensions ADD CONSTRAINT extensions_tenant_external_id_fkey FOREIGN KEY (tenant_external_id) REFERENCES _realtime.tenants(external_id);
    RAISE NOTICE 'Tenant renamed to realtime';

  ELSE
    RAISE NOTICE 'Tenant already correct';
  END IF;
END
$$;
