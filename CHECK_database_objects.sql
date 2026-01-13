-- 检查所有视图定义
SELECT 
    schemaname as "Schema",
    viewname as "视图名",
    definition as "定义"
FROM pg_views
WHERE schemaname = 'public'
ORDER BY viewname;

-- 检查所有 RPC 函数
SELECT 
    routine_name as "函数名",
    routine_definition as "定义"
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- 检查所有触发器
SELECT 
    trigger_name as "触发器名",
    event_object_table as "表名",
    action_statement as "操作"
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;



