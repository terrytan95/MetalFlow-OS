import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
export default tseslint.config(eslint.configs.recommended,...tseslint.configs.recommended,{ignores:['**/.next/**','**/node_modules/**','designs/**']},{rules:{'@typescript-eslint/no-explicit-any':'off','@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}],'no-empty':['error',{allowEmptyCatch:true}]}});
