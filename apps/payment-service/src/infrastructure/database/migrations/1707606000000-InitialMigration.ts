import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialMigration1707606000000 implements MigrationInterface {
    name = 'InitialMigration1707606000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TYPE "public"."payments_status_enum" AS ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED')`
        );
        await queryRunner.query(
            `CREATE TYPE "public"."payments_method_enum" AS ENUM('CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'BOLETO')`
        );
        await queryRunner.query(
            `CREATE TABLE "payments" ("id" uuid NOT NULL, "order_id" uuid NOT NULL, "user_id" uuid NOT NULL, "amount" numeric(10,2) NOT NULL, "status" "public"."payments_status_enum" NOT NULL DEFAULT 'PENDING', "method" "public"."payments_method_enum" NOT NULL, "transaction_id" varchar, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP TYPE "public"."payments_method_enum"`);
        await queryRunner.query(`DROP TYPE "public"."payments_status_enum"`);
    }
}
