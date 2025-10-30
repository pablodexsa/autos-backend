import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateInstallmentSetting1713450000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "installment_settings",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          {
            name: "installments",
            type: "int",
            isNullable: false,
          },
          {
            name: "percentage",
            type: "decimal",
            precision: 5,
            scale: 2,
            isNullable: false,
          },
        ],
      }),
      true
    );

    // Insertar valores iniciales
    await queryRunner.query(`
      INSERT INTO installment_settings (installments, percentage) VALUES
      (12, 60.00),
      (18, 90.00),
      (24, 120.00),
      (30, 150.00);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("installment_settings");
  }
}
