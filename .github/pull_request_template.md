# Pull Request: Setup Database Integration with Drizzle ORM & node-postgres

## Description
This PR configures the TypeScript/Express project to integrate with a Neon PostgreSQL database using Drizzle ORM and the classic `node-postgres` (`pg`) driver.

### Changes Introduced:
1. **TypeScript & Express Setup**: Installed typescript, express, ts-node, tsx, and types.
2. **Database Integration**:
   * Installed `drizzle-orm`, `pg` (node-postgres), and `dotenv`.
   * Created a workspace-wide agent config [.clinerules](file:///c:/Users/coded/Desktop/live-scorez/.clinerules) defining branch naming workflows (e.g., `feat/(feature-name)`).
   * Configured [drizzle.config.ts](file:///c:/Users/coded/Desktop/live-scorez/drizzle.config.ts) for generating schema migrations.
   * Created [src/db/db.ts](file:///c:/Users/coded/Desktop/live-scorez/src/db/db.ts) to export the Drizzle database instance and the Postgres connection pool.
   * Added the db migration commands to `package.json` under `db:generate` and `db:migrate`.
3. **Template & Safety**:
   * Added a placeholder [.env](file:///c:/Users/coded/Desktop/live-scorez/.env) file for safe connection configuration. Verified that `.env` is completely excluded from the commit via `.gitignore`.
   * Created [pull_request.md](file:///c:/Users/coded/Desktop/live-scorez/pull_request.md) to serve as a guideline template for future pull requests.

## Checklist
- [x] My code follows the style guidelines of this project
- [x] I have performed a self-review of my own code
- [x] I have commented my code, particularly in hard-to-understand areas
- [x] My changes generate no new warnings or console errors
- [x] No sensitive credentials or connection strings are pushed (.env is gitignored)

## Verification Details
- **Verification Command**: Run `npm run db:generate` to verify schema compilation and migrations generation.
- **Staging Verification**: SQL migrations were successfully generated under `drizzle/0000_tidy_doctor_faustus.sql`.
