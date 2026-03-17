-- ============================================
-- RPC: create_recipe
-- ============================================
-- Creates a recipe with ingredients and steps in a single transaction
-- Returns recipe with category join for card rendering

CREATE OR REPLACE FUNCTION create_recipe(
  recipe_data jsonb,
  ingredients_data jsonb,
  steps_data jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recipe_id uuid;
  v_recipe_record record;
  v_ingredient jsonb;
  v_step jsonb;
BEGIN
  -- Validate required fields
  IF recipe_data->>'title' IS NULL OR trim(recipe_data->>'title') = '' THEN
    RAISE EXCEPTION 'title is required';
  END IF;

  IF jsonb_array_length(ingredients_data) = 0 THEN
    RAISE EXCEPTION 'at least one ingredient is required';
  END IF;

  IF jsonb_array_length(steps_data) = 0 THEN
    RAISE EXCEPTION 'at least one step is required';
  END IF;

  -- Insert recipe
  -- Note: user_id intentionally omitted - anonymous recipe creation is allowed
  -- Auth context to be added in future enhancement
  INSERT INTO recipes (
    title,
    description,
    category_id,
    image_url,
    prep_time,
    cook_time,
    servings,
    is_published,
    created_at,
    updated_at
  ) VALUES (
    recipe_data->>'title',
    recipe_data->>'description',
    (recipe_data->>'category_id')::uuid,
    recipe_data->>'image_url',
    (recipe_data->>'prep_time')::integer,
    (recipe_data->>'cook_time')::integer,
    (recipe_data->>'servings')::integer,
    COALESCE((recipe_data->>'is_published')::boolean, true),
    NOW(),
    NOW()
  ) RETURNING id INTO v_recipe_id;

  -- Insert ingredients
  FOR v_ingredient IN SELECT * FROM jsonb_array_elements(ingredients_data)
  LOOP
    INSERT INTO ingredients (
      recipe_id,
      name,
      amount,
      unit,
      sort_order
    ) VALUES (
      v_recipe_id,
      v_ingredient->>'name',
      (v_ingredient->>'amount')::decimal(10,2),
      v_ingredient->>'unit',
      COALESCE((v_ingredient->>'sort_order')::integer, 0)
    );
  END LOOP;

  -- Insert steps
  FOR v_step IN SELECT * FROM jsonb_array_elements(steps_data)
  LOOP
    INSERT INTO recipe_steps (
      recipe_id,
      step_number,
      description
    ) VALUES (
      v_recipe_id,
      (v_step->>'step_number')::integer,
      v_step->>'description'
    );
  END LOOP;

  -- Fetch recipe with category for response
  SELECT
    r.id,
    r.title,
    r.description,
    r.image_url,
    r.prep_time,
    r.cook_time,
    r.servings,
    r.created_at,
    c.name as category_name
  INTO v_recipe_record
  FROM recipes r
  LEFT JOIN categories c ON c.id = r.category_id
  WHERE r.id = v_recipe_id;

  -- Return as JSONB
  RETURN jsonb_build_object(
    'id', v_recipe_record.id,
    'title', v_recipe_record.title,
    'description', v_recipe_record.description,
    'image_url', v_recipe_record.image_url,
    'prep_time', v_recipe_record.prep_time,
    'cook_time', v_recipe_record.cook_time,
    'servings', v_recipe_record.servings,
    'created_at', v_recipe_record.created_at,
    'category_name', v_recipe_record.category_name
  );
END;
$$;
