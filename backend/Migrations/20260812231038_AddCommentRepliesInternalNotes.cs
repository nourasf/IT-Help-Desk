using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace backend.Migrations
{
    public partial class AddCommentRepliesInternalNotes : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<DateTime>(
                name: "ResolvedAt",
                table: "Tickets",
                type: "datetime2",
                nullable: true,
                oldClrType: typeof(DateTime),
                oldType: "datetime2");

            migrationBuilder.AddColumn<bool>(
                name: "IsInternal",
                table: "TicketComments",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "ParentCommentID",
                table: "TicketComments",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_TicketComments_ParentCommentID",
                table: "TicketComments",
                column: "ParentCommentID");

            migrationBuilder.AddForeignKey(
                name: "FK_TicketComments_TicketComments_ParentCommentID",
                table: "TicketComments",
                column: "ParentCommentID",
                principalTable: "TicketComments",
                principalColumn: "ID",
                onDelete: ReferentialAction.Restrict);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TicketComments_TicketComments_ParentCommentID",
                table: "TicketComments");

            migrationBuilder.DropIndex(
                name: "IX_TicketComments_ParentCommentID",
                table: "TicketComments");

            migrationBuilder.DropColumn(
                name: "IsInternal",
                table: "TicketComments");

            migrationBuilder.DropColumn(
                name: "ParentCommentID",
                table: "TicketComments");

            migrationBuilder.AlterColumn<DateTime>(
                name: "ResolvedAt",
                table: "Tickets",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(
                    1, 1, 1, 0, 0, 0, 0,
                    DateTimeKind.Unspecified
                ),
                oldClrType: typeof(DateTime),
                oldType: "datetime2",
                oldNullable: true);
        }
    }
}