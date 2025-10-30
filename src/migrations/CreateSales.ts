import { MigrationInterface, QueryRunner, Table, TableForeignKey } from "typeorm";

export class CreateSales1734748800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "sales",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          {
            name: "saleDate",
            type: "date",
            isNullable: false,
          },
          {
            name: "vehicleId",
            type: "int",
            isNullable: false,
          },
          {
            name: "paymentType",
            type: "varchar",
            isNullable: false,
          },
          {
            name: "price",
            type: "decimal",
            precision: 10,
            scale: 2,
            isNullable: false,
          },
          {
            name: "downPayment",
            type: "decimal",
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: "installments",
            type: "int",
            isNullable: true,
          },
          {
            name: "installmentValue",
            type: "decimal",
            precision: 10,
            scale: 2,
            isNullable: true,
          },
          {
            name: "installmentPlanId",
            type: "int",
            isNullable: true,
          },
        ],
      })
    );

    // ?? ForeignKey hacia vehicles
    await queryRunner.createForeignKey(
      "sales",
      new TableForeignKey({
        columnNames: ["vehicleId"],
        referencedTableName: "vehicles",
        referencedColumnNames: ["id"],
        onDelete: "CASCADE",
      })
    );

    // ?? ForeignKey hacia installment_settings
    await queryRunner.createForeignKey(
      "sales",
      new TableForeignKey({
        columnNames: ["installmentPlanId"],
        referencedTableName: "installment_setting",
        referencedColumnNames: ["id"],
        onDelete: "SET NULL",
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("sales");
  }
}
