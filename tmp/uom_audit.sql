SELECT p.name, p.uom, p.metadata as product_meta, 
       b.batch_no, b.qty_on_hand, b.cost, b.mrp, b.sale_price,
       l.qty, l.uom as move_uom, l.unit_cost, l.metadata as ledger_meta
FROM hms_product p
JOIN hms_product_batch b ON b.product_id = p.id
JOIN hms_stock_ledger l ON l.batch_id = b.id
WHERE p.name ILIKE '%ON CALL PLUS STRIPS%'
ORDER BY l.created_at DESC
LIMIT 5;
