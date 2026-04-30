-- Nigeria delivery is configured via LGA rates + default setting, not shipping_zones.
DELETE FROM "shipping_zones"
WHERE cardinality("countries") = 1 AND upper("countries"[1]) = 'NG';
