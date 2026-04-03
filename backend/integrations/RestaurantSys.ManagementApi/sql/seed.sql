SET search_path = public;

/* ===== Default menu baseline ===== */

-- schema.sql inserts menu 0 before the root trigger exists, so we ensure its root explicitly.
INSERT INTO menu_nodes (node_id, parent_id, name, is_leaf, price_cents, sort_order, layer, menu_num)
SELECT
  '11111111-1111-1111-1111-111111111000'::uuid,
  NULL,
  m.name,
  FALSE,
  NULL,
  0,
  0,
  m.menu_num
FROM menus m
WHERE m.menu_num = 0
  AND NOT EXISTS (
    SELECT 1
    FROM menu_nodes mn
    WHERE mn.menu_num = m.menu_num
      AND mn.layer = 0
      AND mn.parent_id IS NULL
  );

UPDATE management_settings
SET
  active_menu_num = COALESCE(active_menu_num, 0),
  updated_at = now()
WHERE id = 1
  AND EXISTS (SELECT 1 FROM menus WHERE menu_num = 0);

/* ===== Ingredients ===== */

INSERT INTO ingredients (name)
VALUES
  ('Gin'),
  ('Campari'),
  ('Sweet Vermouth'),
  ('Tonic Water'),
  ('Lime Juice'),
  ('Rum'),
  ('Soda Water'),
  ('Mint'),
  ('Sugar Syrup'),
  ('Tequila'),
  ('Triple Sec'),
  ('Cola'),
  ('Lemonade'),
  ('Orange Juice'),
  ('Sparkling Water'),
  ('Red Wine'),
  ('White Wine'),
  ('Potato'),
  ('Chicken'),
  ('Slider Bun'),
  ('Cheddar'),
  ('Cheesecake Cream'),
  ('Biscuit Crumb')
ON CONFLICT (name) DO NOTHING;

/* ===== Menu hierarchy for the default menu ===== */

WITH default_root AS (
  SELECT node_id
  FROM menu_nodes
  WHERE menu_num = 0
    AND layer = 0
    AND parent_id IS NULL
),
can_seed AS (
  SELECT root.node_id AS root_id
  FROM default_root root
  WHERE NOT EXISTS (
    SELECT 1
    FROM menu_nodes mn
    WHERE mn.menu_num = 0
      AND mn.layer > 0
  )
)
INSERT INTO menu_nodes (node_id, parent_id, name, is_leaf, price_cents, sort_order, layer, menu_num)
SELECT
  seeded.node_id,
  can_seed.root_id,
  seeded.name,
  seeded.is_leaf,
  NULL,
  seeded.sort_order,
  seeded.layer,
  0
FROM can_seed
CROSS JOIN (
  VALUES
    ('11111111-1111-1111-1111-111111111001'::uuid, 'Drinks', FALSE, 0, 1),
    ('11111111-1111-1111-1111-111111111002'::uuid, 'Food', FALSE, 1, 1)
) AS seeded(node_id, name, is_leaf, sort_order, layer);

WITH can_seed AS (
  SELECT 1
  WHERE EXISTS (
    SELECT 1
    FROM menu_nodes
    WHERE node_id = '11111111-1111-1111-1111-111111111001'::uuid
  )
    AND EXISTS (
      SELECT 1
      FROM menu_nodes
      WHERE node_id = '11111111-1111-1111-1111-111111111002'::uuid
    )
    AND NOT EXISTS (
      SELECT 1
      FROM menu_nodes mn
      WHERE mn.menu_num = 0
        AND mn.layer > 1
    )
)
INSERT INTO menu_nodes (node_id, parent_id, name, is_leaf, price_cents, sort_order, layer, menu_num)
SELECT
  seeded.node_id,
  seeded.parent_id,
  seeded.name,
  seeded.is_leaf,
  NULL,
  seeded.sort_order,
  seeded.layer,
  0
FROM can_seed
CROSS JOIN (
  VALUES
    ('11111111-1111-1111-1111-111111111101'::uuid, '11111111-1111-1111-1111-111111111001'::uuid, 'Cocktails', TRUE, 0, 2),
    ('11111111-1111-1111-1111-111111111102'::uuid, '11111111-1111-1111-1111-111111111001'::uuid, 'Beer', TRUE, 1, 2),
    ('11111111-1111-1111-1111-111111111103'::uuid, '11111111-1111-1111-1111-111111111001'::uuid, 'Soft Drinks', TRUE, 2, 2),
    ('11111111-1111-1111-1111-111111111104'::uuid, '11111111-1111-1111-1111-111111111001'::uuid, 'Wine', TRUE, 3, 2),
    ('11111111-1111-1111-1111-111111111201'::uuid, '11111111-1111-1111-1111-111111111002'::uuid, 'Small Plates', TRUE, 0, 2),
    ('11111111-1111-1111-1111-111111111202'::uuid, '11111111-1111-1111-1111-111111111002'::uuid, 'Desserts', TRUE, 1, 2)
) AS seeded(node_id, parent_id, name, is_leaf, sort_order, layer);

/* ===== Products ===== */

WITH can_seed AS (
  SELECT 1
  WHERE EXISTS (
    SELECT 1
    FROM menu_nodes
    WHERE node_id = '11111111-1111-1111-1111-111111111101'::uuid
  )
    AND NOT EXISTS (SELECT 1 FROM products)
)
INSERT INTO products (product_id, menu_node_id, name, type, sold_as_bottle_only)
SELECT
  seeded.product_id,
  seeded.menu_node_id,
  seeded.name,
  seeded.type,
  seeded.sold_as_bottle_only
FROM can_seed
CROSS JOIN (
  VALUES
    ('22222222-2222-2222-2222-222222222001'::uuid, '11111111-1111-1111-1111-111111111101'::uuid, 'Negroni', 'Cocktail', FALSE),
    ('22222222-2222-2222-2222-222222222002'::uuid, '11111111-1111-1111-1111-111111111101'::uuid, 'Gin & Tonic', 'Cocktail', FALSE),
    ('22222222-2222-2222-2222-222222222003'::uuid, '11111111-1111-1111-1111-111111111101'::uuid, 'Mojito', 'Cocktail', FALSE),
    ('22222222-2222-2222-2222-222222222004'::uuid, '11111111-1111-1111-1111-111111111101'::uuid, 'Margarita', 'Cocktail', FALSE),
    ('22222222-2222-2222-2222-222222222005'::uuid, '11111111-1111-1111-1111-111111111102'::uuid, 'Lager Pint', 'Beer', FALSE),
    ('22222222-2222-2222-2222-222222222006'::uuid, '11111111-1111-1111-1111-111111111102'::uuid, 'IPA Pint', 'Beer', FALSE),
    ('22222222-2222-2222-2222-222222222007'::uuid, '11111111-1111-1111-1111-111111111103'::uuid, 'Cola', 'Soft Drink', FALSE),
    ('22222222-2222-2222-2222-222222222008'::uuid, '11111111-1111-1111-1111-111111111103'::uuid, 'Lemonade', 'Soft Drink', FALSE),
    ('22222222-2222-2222-2222-222222222009'::uuid, '11111111-1111-1111-1111-111111111103'::uuid, 'Orange Juice', 'Soft Drink', FALSE),
    ('22222222-2222-2222-2222-222222222010'::uuid, '11111111-1111-1111-1111-111111111103'::uuid, 'Sparkling Water', 'Soft Drink', FALSE),
    ('22222222-2222-2222-2222-222222222011'::uuid, '11111111-1111-1111-1111-111111111104'::uuid, 'House Red Glass', 'Wine', FALSE),
    ('22222222-2222-2222-2222-222222222012'::uuid, '11111111-1111-1111-1111-111111111104'::uuid, 'House White Glass', 'Wine', FALSE),
    ('22222222-2222-2222-2222-222222222013'::uuid, '11111111-1111-1111-1111-111111111201'::uuid, 'Fries Basket', 'Food', FALSE),
    ('22222222-2222-2222-2222-222222222014'::uuid, '11111111-1111-1111-1111-111111111201'::uuid, 'Chicken Sliders', 'Food', FALSE),
    ('22222222-2222-2222-2222-222222222015'::uuid, '11111111-1111-1111-1111-111111111202'::uuid, 'Cheesecake Slice', 'Dessert', FALSE)
) AS seeded(product_id, menu_node_id, name, type, sold_as_bottle_only);

INSERT INTO product_menu_nodes (product_id, menu_node_id)
SELECT seeded.product_id, seeded.menu_node_id
FROM (
  VALUES
    ('22222222-2222-2222-2222-222222222001'::uuid, '11111111-1111-1111-1111-111111111101'::uuid),
    ('22222222-2222-2222-2222-222222222002'::uuid, '11111111-1111-1111-1111-111111111101'::uuid),
    ('22222222-2222-2222-2222-222222222003'::uuid, '11111111-1111-1111-1111-111111111101'::uuid),
    ('22222222-2222-2222-2222-222222222004'::uuid, '11111111-1111-1111-1111-111111111101'::uuid),
    ('22222222-2222-2222-2222-222222222005'::uuid, '11111111-1111-1111-1111-111111111102'::uuid),
    ('22222222-2222-2222-2222-222222222006'::uuid, '11111111-1111-1111-1111-111111111102'::uuid),
    ('22222222-2222-2222-2222-222222222007'::uuid, '11111111-1111-1111-1111-111111111103'::uuid),
    ('22222222-2222-2222-2222-222222222008'::uuid, '11111111-1111-1111-1111-111111111103'::uuid),
    ('22222222-2222-2222-2222-222222222009'::uuid, '11111111-1111-1111-1111-111111111103'::uuid),
    ('22222222-2222-2222-2222-222222222010'::uuid, '11111111-1111-1111-1111-111111111103'::uuid),
    ('22222222-2222-2222-2222-222222222011'::uuid, '11111111-1111-1111-1111-111111111104'::uuid),
    ('22222222-2222-2222-2222-222222222012'::uuid, '11111111-1111-1111-1111-111111111104'::uuid),
    ('22222222-2222-2222-2222-222222222013'::uuid, '11111111-1111-1111-1111-111111111201'::uuid),
    ('22222222-2222-2222-2222-222222222014'::uuid, '11111111-1111-1111-1111-111111111201'::uuid),
    ('22222222-2222-2222-2222-222222222015'::uuid, '11111111-1111-1111-1111-111111111202'::uuid)
) AS seeded(product_id, menu_node_id)
JOIN products p
  ON p.product_id = seeded.product_id
JOIN menu_nodes mn
  ON mn.node_id = seeded.menu_node_id
ON CONFLICT (product_id, menu_node_id) DO NOTHING;

WITH ingredient_map AS (
  SELECT ingredient_id, name
  FROM ingredients
  WHERE name IN (
    'Gin', 'Campari', 'Sweet Vermouth', 'Tonic Water', 'Lime Juice',
    'Rum', 'Soda Water', 'Mint', 'Sugar Syrup', 'Tequila', 'Triple Sec',
    'Cola', 'Lemonade', 'Orange Juice', 'Sparkling Water', 'Red Wine',
    'White Wine', 'Potato', 'Chicken', 'Slider Bun', 'Cheddar',
    'Cheesecake Cream', 'Biscuit Crumb'
  )
)
INSERT INTO product_ingredients (product_id, ingredient_id, changeable, is_leading)
SELECT
  seeded.product_id,
  ingredient_map.ingredient_id,
  seeded.changeable,
  seeded.is_leading
FROM (
  VALUES
    ('22222222-2222-2222-2222-222222222001'::uuid, 'Gin', FALSE, TRUE),
    ('22222222-2222-2222-2222-222222222001'::uuid, 'Campari', FALSE, FALSE),
    ('22222222-2222-2222-2222-222222222001'::uuid, 'Sweet Vermouth', FALSE, FALSE),
    ('22222222-2222-2222-2222-222222222002'::uuid, 'Gin', FALSE, TRUE),
    ('22222222-2222-2222-2222-222222222002'::uuid, 'Tonic Water', FALSE, FALSE),
    ('22222222-2222-2222-2222-222222222002'::uuid, 'Lime Juice', TRUE, FALSE),
    ('22222222-2222-2222-2222-222222222003'::uuid, 'Rum', FALSE, TRUE),
    ('22222222-2222-2222-2222-222222222003'::uuid, 'Soda Water', FALSE, FALSE),
    ('22222222-2222-2222-2222-222222222003'::uuid, 'Mint', TRUE, FALSE),
    ('22222222-2222-2222-2222-222222222003'::uuid, 'Sugar Syrup', FALSE, FALSE),
    ('22222222-2222-2222-2222-222222222003'::uuid, 'Lime Juice', FALSE, FALSE),
    ('22222222-2222-2222-2222-222222222004'::uuid, 'Tequila', FALSE, TRUE),
    ('22222222-2222-2222-2222-222222222004'::uuid, 'Triple Sec', FALSE, FALSE),
    ('22222222-2222-2222-2222-222222222004'::uuid, 'Lime Juice', FALSE, FALSE),
    ('22222222-2222-2222-2222-222222222007'::uuid, 'Cola', FALSE, TRUE),
    ('22222222-2222-2222-2222-222222222008'::uuid, 'Lemonade', FALSE, TRUE),
    ('22222222-2222-2222-2222-222222222009'::uuid, 'Orange Juice', FALSE, TRUE),
    ('22222222-2222-2222-2222-222222222010'::uuid, 'Sparkling Water', FALSE, TRUE),
    ('22222222-2222-2222-2222-222222222011'::uuid, 'Red Wine', FALSE, TRUE),
    ('22222222-2222-2222-2222-222222222012'::uuid, 'White Wine', FALSE, TRUE),
    ('22222222-2222-2222-2222-222222222013'::uuid, 'Potato', FALSE, TRUE),
    ('22222222-2222-2222-2222-222222222014'::uuid, 'Chicken', FALSE, TRUE),
    ('22222222-2222-2222-2222-222222222014'::uuid, 'Slider Bun', FALSE, FALSE),
    ('22222222-2222-2222-2222-222222222014'::uuid, 'Cheddar', TRUE, FALSE),
    ('22222222-2222-2222-2222-222222222015'::uuid, 'Cheesecake Cream', FALSE, TRUE),
    ('22222222-2222-2222-2222-222222222015'::uuid, 'Biscuit Crumb', FALSE, FALSE)
) AS seeded(product_id, ingredient_name, changeable, is_leading)
JOIN products p
  ON p.product_id = seeded.product_id
JOIN ingredient_map
  ON ingredient_map.name = seeded.ingredient_name
ON CONFLICT (product_id, ingredient_id) DO NOTHING;

INSERT INTO product_prices (product_id, menu_num, price)
SELECT seeded.product_id, seeded.menu_num, seeded.price
FROM (
  VALUES
    ('22222222-2222-2222-2222-222222222001'::uuid, 0, 5800),
    ('22222222-2222-2222-2222-222222222002'::uuid, 0, 5200),
    ('22222222-2222-2222-2222-222222222003'::uuid, 0, 5400),
    ('22222222-2222-2222-2222-222222222004'::uuid, 0, 5600),
    ('22222222-2222-2222-2222-222222222005'::uuid, 0, 3200),
    ('22222222-2222-2222-2222-222222222006'::uuid, 0, 3600),
    ('22222222-2222-2222-2222-222222222007'::uuid, 0, 1400),
    ('22222222-2222-2222-2222-222222222008'::uuid, 0, 1400),
    ('22222222-2222-2222-2222-222222222009'::uuid, 0, 1600),
    ('22222222-2222-2222-2222-222222222010'::uuid, 0, 1300),
    ('22222222-2222-2222-2222-222222222011'::uuid, 0, 3400),
    ('22222222-2222-2222-2222-222222222012'::uuid, 0, 3400),
    ('22222222-2222-2222-2222-222222222013'::uuid, 0, 2600),
    ('22222222-2222-2222-2222-222222222014'::uuid, 0, 4800),
    ('22222222-2222-2222-2222-222222222015'::uuid, 0, 2800)
) AS seeded(product_id, menu_num, price)
JOIN products p
  ON p.product_id = seeded.product_id
JOIN menus m
  ON m.menu_num = seeded.menu_num
ON CONFLICT (product_id, menu_num) DO NOTHING;

/* ===== Stations ===== */

INSERT INTO stations (station_id, station_name, station_type, is_active)
SELECT seeded.station_id, seeded.station_name, seeded.station_type, TRUE
FROM (
  VALUES
    ('33333333-3333-3333-3333-333333333001'::uuid, 'Main Bar', 'Bar'),
    ('33333333-3333-3333-3333-333333333002'::uuid, 'Main Floor', 'Floor'),
    ('33333333-3333-3333-3333-333333333003'::uuid, 'Patio Floor', 'Floor'),
    ('33333333-3333-3333-3333-333333333004'::uuid, 'Kitchen Pass', 'Kitchen'),
    ('33333333-3333-3333-3333-333333333005'::uuid, 'Checker Desk', 'Checker'),
    ('33333333-3333-3333-3333-333333333006'::uuid, 'Host Stand', 'Hostes')
) AS seeded(station_id, station_name, station_type)
WHERE NOT EXISTS (SELECT 1 FROM stations);

/* ===== Lists and names ===== */

INSERT INTO lists (list_id, title, list_type)
SELECT seeded.list_id, seeded.title, seeded.list_type
FROM (
  VALUES
    ('44444444-4444-4444-4444-444444444001'::uuid, 'Walk-In Waiting List', 'Names'),
    ('44444444-4444-4444-4444-444444444002'::uuid, 'Reservations Tonight', 'Tables')
) AS seeded(list_id, title, list_type)
WHERE NOT EXISTS (SELECT 1 FROM lists);

INSERT INTO list_entries (entry_id, list_id, arrived, name, phone, note, num_people, start_time, end_time, minutes)
SELECT
  seeded.entry_id,
  seeded.list_id,
  seeded.arrived,
  seeded.name,
  seeded.phone,
  seeded.note,
  seeded.num_people,
  seeded.start_time,
  seeded.end_time,
  seeded.minutes
FROM (
  VALUES
    ('55555555-5555-5555-5555-555555555001'::uuid, '44444444-4444-4444-4444-444444444001'::uuid, FALSE, 'Noa Levi',  '050-111-2233', 'Birthday walk-in', NULL, NULL::time, NULL::time, NULL),
    ('55555555-5555-5555-5555-555555555002'::uuid, '44444444-4444-4444-4444-444444444001'::uuid, TRUE,  'Eitan Cohen', '050-444-5566', 'Waiting near the bar', NULL, NULL::time, NULL::time, NULL),
    ('55555555-5555-5555-5555-555555555003'::uuid, '44444444-4444-4444-4444-444444444002'::uuid, FALSE, 'Maya Azulay', '052-300-8899', 'Window preference', 4, '19:30'::time, '21:30'::time, 120),
    ('55555555-5555-5555-5555-555555555004'::uuid, '44444444-4444-4444-4444-444444444002'::uuid, FALSE, 'Daniel Ben Ami', '052-888-1122', 'Anniversary', 2, '20:00'::time, '22:00'::time, 120),
    ('55555555-5555-5555-5555-555555555005'::uuid, '44444444-4444-4444-4444-444444444002'::uuid, TRUE,  'Yael Mor', '054-222-9090', 'High chair needed', 5, '18:45'::time, '20:45'::time, 120)
) AS seeded(entry_id, list_id, arrived, name, phone, note, num_people, start_time, end_time, minutes)
JOIN lists l
  ON l.list_id = seeded.list_id
WHERE NOT EXISTS (SELECT 1 FROM list_entries);

INSERT INTO station_lists (station_id, list_id)
SELECT seeded.station_id, seeded.list_id
FROM (
  VALUES
    ('33333333-3333-3333-3333-333333333006'::uuid, '44444444-4444-4444-4444-444444444001'::uuid),
    ('33333333-3333-3333-3333-333333333006'::uuid, '44444444-4444-4444-4444-444444444002'::uuid),
    ('33333333-3333-3333-3333-333333333002'::uuid, '44444444-4444-4444-4444-444444444002'::uuid)
) AS seeded(station_id, list_id)
WHERE EXISTS (
  SELECT 1
  FROM stations
  WHERE station_id = seeded.station_id
)
  AND EXISTS (
    SELECT 1
    FROM lists
    WHERE list_id = seeded.list_id
  )
ON CONFLICT (station_id, list_id) DO NOTHING;

/* ===== Physical tables ===== */

INSERT INTO tables (table_id, table_number)
SELECT seeded.table_id, seeded.table_number
FROM (
  VALUES
    ('66666666-6666-6666-6666-666666666001'::uuid, 1),
    ('66666666-6666-6666-6666-666666666002'::uuid, 2),
    ('66666666-6666-6666-6666-666666666003'::uuid, 3),
    ('66666666-6666-6666-6666-666666666004'::uuid, 4),
    ('66666666-6666-6666-6666-666666666005'::uuid, 5),
    ('66666666-6666-6666-6666-666666666006'::uuid, 6),
    ('66666666-6666-6666-6666-666666666007'::uuid, 7),
    ('66666666-6666-6666-6666-666666666008'::uuid, 8),
    ('66666666-6666-6666-6666-666666666009'::uuid, 11),
    ('66666666-6666-6666-6666-666666666010'::uuid, 12),
    ('66666666-6666-6666-6666-666666666011'::uuid, 21),
    ('66666666-6666-6666-6666-666666666012'::uuid, 22)
) AS seeded(table_id, table_number)
WHERE NOT EXISTS (SELECT 1 FROM tables);

INSERT INTO station_tables (station_id, table_id)
SELECT seeded.station_id, seeded.table_id
FROM (
  VALUES
    ('33333333-3333-3333-3333-333333333002'::uuid, '66666666-6666-6666-6666-666666666001'::uuid),
    ('33333333-3333-3333-3333-333333333002'::uuid, '66666666-6666-6666-6666-666666666002'::uuid),
    ('33333333-3333-3333-3333-333333333002'::uuid, '66666666-6666-6666-6666-666666666003'::uuid),
    ('33333333-3333-3333-3333-333333333002'::uuid, '66666666-6666-6666-6666-666666666004'::uuid),
    ('33333333-3333-3333-3333-333333333002'::uuid, '66666666-6666-6666-6666-666666666005'::uuid),
    ('33333333-3333-3333-3333-333333333002'::uuid, '66666666-6666-6666-6666-666666666006'::uuid),
    ('33333333-3333-3333-3333-333333333003'::uuid, '66666666-6666-6666-6666-666666666007'::uuid),
    ('33333333-3333-3333-3333-333333333003'::uuid, '66666666-6666-6666-6666-666666666008'::uuid),
    ('33333333-3333-3333-3333-333333333003'::uuid, '66666666-6666-6666-6666-666666666009'::uuid),
    ('33333333-3333-3333-3333-333333333003'::uuid, '66666666-6666-6666-6666-666666666010'::uuid),
    ('33333333-3333-3333-3333-333333333001'::uuid, '66666666-6666-6666-6666-666666666011'::uuid),
    ('33333333-3333-3333-3333-333333333001'::uuid, '66666666-6666-6666-6666-666666666012'::uuid)
) AS seeded(station_id, table_id)
WHERE EXISTS (
  SELECT 1
  FROM stations
  WHERE station_id = seeded.station_id
)
  AND EXISTS (
    SELECT 1
    FROM tables
    WHERE table_id = seeded.table_id
  )
ON CONFLICT (station_id, table_id) DO NOTHING;
