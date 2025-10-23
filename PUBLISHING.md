# 📦 Guia de Publicação no NPM

Este guia explica como publicar o `better-auth-typeorm-adapter` no NPM.

## ✅ Pré-requisitos

1. **Conta no NPM**
   - Crie uma conta em: https://www.npmjs.com/signup
   - Verifique seu email

2. **Login no NPM via CLI**
   ```bash
   npm login
   ```
   - Digite seu username, password e email
   - Se tiver 2FA habilitado, digite o código

## 🚀 Passos para Publicar

### 1. Verificar se o nome está disponível

```bash
npm search better-auth-typeorm-adapter
```

Se não encontrar nada, o nome está disponível! ✅

### 2. Build do projeto

```bash
npm run build
```

Isso vai:
- Compilar o TypeScript para JavaScript
- Gerar os arquivos `.d.ts` (tipos)
- Criar a pasta `dist/`

### 3. Testar localmente (opcional mas recomendado)

```bash
npm pack
```

Isso cria um arquivo `.tgz` que você pode testar em outro projeto:

```bash
cd /caminho/para/outro/projeto
npm install /caminho/para/better-auth-typeorm-adapter-1.0.0.tgz
```

### 4. Publicar no NPM

```bash
npm publish
```

**Pronto!** Seu pacote está no NPM! 🎉

## 📝 Atualizações Futuras

Quando fizer mudanças e quiser publicar uma nova versão:

### 1. Atualizar a versão

```bash
# Para bug fixes (1.0.0 -> 1.0.1)
npm version patch

# Para novas features (1.0.0 -> 1.1.0)
npm version minor

# Para breaking changes (1.0.0 -> 2.0.0)
npm version major
```

### 2. Fazer push das tags

```bash
git push && git push --tags
```

### 3. Publicar

```bash
npm publish
```

## 🔍 Verificar Publicação

Após publicar, verifique em:
- https://www.npmjs.com/package/better-auth-typeorm-adapter
- Aguarde alguns minutos para o NPM indexar

## 📊 Estatísticas

Você pode ver downloads e estatísticas em:
- https://www.npmjs.com/package/better-auth-typeorm-adapter
- https://npmtrends.com/better-auth-typeorm-adapter

## 🎯 Como os Usuários Vão Usar

### Instalação

```bash
npm install better-auth-typeorm-adapter
# ou
yarn add better-auth-typeorm-adapter
# ou
pnpm add better-auth-typeorm-adapter
```

### Uso no Código

```typescript
import { typeormAdapter } from 'better-auth-typeorm-adapter';
import { betterAuth } from 'better-auth';
import { DataSource } from 'typeorm';

// 1. Configurar DataSource
const AppDataSource = new DataSource({
  type: 'postgres',
  host: 'localhost',
  port: 5432,
  username: 'postgres',
  password: 'postgres',
  database: 'myapp',
  entities: [User, Account, Session, Verification],
  synchronize: false,
});

// 2. Inicializar DataSource
await AppDataSource.initialize();

// 3. Usar o adapter
const auth = betterAuth({
  database: typeormAdapter({
    dataSource: AppDataSource,
    debugLogs: true, // opcional
  }),
  emailAndPassword: {
    enabled: true,
  },
});
```

## 🔐 Repositório Público

**Sim, o repositório DEVE ser público!**

Motivos:
- ✅ Pacotes open source precisam de repositório público
- ✅ NPM vai linkar para o GitHub (badges, issues, etc)
- ✅ Usuários podem ver o código-fonte
- ✅ Permite contribuições da comunidade
- ✅ Aumenta a confiança dos desenvolvedores
- ✅ Melhor para SEO e descoberta

O repositório já está público em:
https://github.com/luratnieks/better-auth-typeorm-adapter

## 📋 Checklist Final

Antes de publicar, verifique:

- [x] Código compilando sem erros
- [x] README.md completo e atualizado
- [x] LICENSE presente (MIT)
- [x] package.json com informações corretas
- [x] URLs do GitHub corretas
- [x] Exemplos de uso funcionando
- [ ] Build rodando (`npm run build`)
- [ ] Testes passando (`npm test`) - se tiver
- [ ] Login no NPM (`npm login`)
- [ ] Nome disponível no NPM

## 🐛 Troubleshooting

### Erro: "You must be logged in to publish packages"
```bash
npm login
```

### Erro: "Package name already exists"
Escolha outro nome no `package.json`

### Erro: "402 Payment Required"
Você está tentando publicar um pacote com escopo privado. Use:
```bash
npm publish --access public
```

### Erro: "403 Forbidden"
Você não tem permissão. Verifique se está logado com a conta correta:
```bash
npm whoami
```

## 🎉 Após Publicar

1. **Adicione badges ao README**
   - Badge do NPM (versão)
   - Badge de downloads
   - Badge de licença

2. **Compartilhe**
   - Twitter/X
   - Reddit (r/typescript, r/node)
   - Discord do Better Auth
   - Dev.to / Medium (artigo sobre o adapter)

3. **Monitore**
   - Issues no GitHub
   - Downloads no NPM
   - Feedback da comunidade

## 📚 Recursos

- [NPM Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Semantic Versioning](https://semver.org/)
- [NPM Documentation](https://docs.npmjs.com/)

