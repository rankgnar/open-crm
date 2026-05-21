UPDATE projekt_statusar SET namn = 'Inkommen' WHERE namn = 'Pendiente';
UPDATE projekt SET status = 'Inkommen' WHERE status = 'Pendiente';
