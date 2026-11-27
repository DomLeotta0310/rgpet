# PetfiQ / RG Pet — migração de autenticação e segurança

Estado: **planejamento de implantação; NÃO ativar bloqueios em produção sem migrar as contas**.

## Diagnóstico (27/11/2026)
- Dois PWAs/domínios: `rgpet.vercel.app` (tutores) e `petfiq-adm.vercel.app` (admin); ambos compartilham banco e código.
- 7 tutores no banco antigo, 0 usuários em `auth.users`, 0 tutores com `auth_user_id`. Há senhas legadas armazenadas no banco.
- As tabelas `tutores`, `pets`, `pedidos`, `configuracoes` possuem políticas RLS públicas permissivas com `USING (true)`/`WITH CHECK (true)`. Um login apenas no frontend **não protege dados nem ações de administração**.
- Há estrutura preparatória `tutores.auth_user_id`, `auth_migrated_at`, `rgpet_auth_migration_log` sem migração de contas realizada.

## Ordem obrigatória antes de produção protegida
1. Definir/validar identidade do(s) administrador(es) e método de recuperação de acesso; não copiar nem solicitar senha por mensagem.
2. Habilitar autenticação via **Supabase Auth** com fluxo de ativação/recuperação para os 7 tutores. Manter sessão legada temporariamente em coexistência controlada até confirmação de migração. Não permitir autorregistro como administrador.
3. Criar marcação de função administrativa **no servidor**, em tabela protegida ou claims seguros; verificar `auth.uid()` em operações privadas, nunca confiar em `?admin=1`, domínio, email digitado, PIN do dispositivo ou `localStorage` para autorização.
4. Atualizar interface do ADM para exigir sessão Supabase Auth válida e verificar papel administrativo antes de carregar informações de tutores/pets, emitir QR administrativo ou executar ações.
5. Substituir consultas públicas diretas a `tutores` e `pets` pela API pública mínima da ficha QR, que retorna apenas dados publicáveis do pet e contato consentido do tutor, por `public_id`. Nunca expor `senha`, PIN, CPF, email privado ou demais dados particulares pela ficha pública.
6. Migrar as requisições do cliente para permissões autenticadas limitadas ao dono; operações do ADM (pedidos, configurações, cupons e tutores) devem ter autorização server-side.
7. Fazer teste completo de criação de conta, login, PIN, reset, cadastro/edição, documentos, QR, ficha pública, pagamento e webhook nos dois domínios.
8. **Só depois** remover políticas públicas `ALL` e revogar permissões anônimas desnecessárias, conferindo via testes reais que nenhum tutor perdeu acesso.
9. Invalidar/remover senhas legadas e limpar sessões antigas com migração concluída. Nunca armazenar senha nova em `public.tutores`.

## Estado/limites
- O código do QR exibido na ficha do ADM é uma melhoria visual; não é barreira de segurança.
- A segurança definitiva está **pendente**, e este arquivo **não é uma migração executável**.
- Não executar `DROP POLICY` das regras atuais antes de o novo fluxo de autenticação e ficha pública estarem funcionando.
