-- Empleados asignados pueden leer las filas de `projekt` correspondientes
-- a sus asignaciones en `projekt_personal`. Sin esta policy, el embed
-- `projekt_personal.select('projekt(...)')` desde la app de empleados
-- devuelve NULL en el join (la policy admin-all no aplica al empleado),
-- haciendo que la lista de "Tilldelade projekt" salga siempre vacía.

DROP POLICY IF EXISTS projekt_select_assigned ON public.projekt;
CREATE POLICY projekt_select_assigned ON public.projekt
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.projekt_personal pp
      JOIN public.personal p ON p.id = pp.personal_id
      WHERE pp.projekt_id = projekt.id
        AND p.supabase_user_id = auth.uid()
        AND lower(p.status) <> 'inaktiv'
    )
  );
