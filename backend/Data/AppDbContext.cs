using backend.Models;
using Microsoft.EntityFrameworkCore;

namespace backend.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options)
        {
        }

        public DbSet<User> Users { get; set; }

        public DbSet<Role> Roles { get; set; }

        public DbSet<Ticket> Tickets { get; set; }

        public DbSet<Category> Categories { get; set; }

        public DbSet<Priority> Priorities { get; set; }

        public DbSet<Status> Statuses { get; set; }

        public DbSet<TicketHistory> TicketHistories { get; set; }

        public DbSet<TicketComment> TicketComments {get; set;}

        public DbSet<TicketAssignment> TicketAssignments { get; set; }

        public DbSet<TicketWorkSession> TicketWorkSessions { get; set; }

        public DbSet<TicketActivityLog> TicketActivityLogs { get; set; }


        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Ticket>()
                .HasOne(t => t.CreatedByUser)
                .WithMany()
                .HasForeignKey(t => t.CreatedByUserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Ticket>()
                .HasOne(t => t.AssignedToUser)
                .WithMany()
                .HasForeignKey(t => t.AssignedToUserId)
                .OnDelete(DeleteBehavior.SetNull);

              modelBuilder.Entity<TicketHistory>()
    .HasOne(h => h.ChangedByUser)
    .WithMany(u => u.TicketHistoryChanges)
    .HasForeignKey(h => h.ChangedByUserID)
    .OnDelete(DeleteBehavior.Restrict);

modelBuilder.Entity<TicketHistory>()
    .HasOne(h => h.Ticket)
    .WithMany(t => t.History)
    .HasForeignKey(h => h.TicketID)
    .OnDelete(DeleteBehavior.Cascade);

                modelBuilder.Entity<TicketComment>()
    .HasOne(c => c.User)
    .WithMany(u => u.TicketComments)
    .HasForeignKey(c => c.UserID)
    .OnDelete(DeleteBehavior.Restrict);


                modelBuilder.Entity<TicketComment>()
    .HasOne(c => c.Ticket)
    .WithMany(t => t.TicketComments)
    .HasForeignKey(c => c.TicketID)
    .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<TicketAssignment>()
                .HasOne(a => a.Ticket)
                .WithMany(t => t.Assignments)
                .HasForeignKey(a => a.TicketID)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<TicketAssignment>()
                .HasOne(a => a.AgentUser)
                .WithMany()
                .HasForeignKey(a => a.AgentUserID)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<TicketAssignment>()
                .HasOne(a => a.AssignedByUser)
                .WithMany()
                .HasForeignKey(a => a.AssignedByUserID)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<TicketAssignment>()
                .HasIndex(a => a.TicketID)
                .IsUnique()
                .HasFilter("[UnassignedAt] IS NULL");

            modelBuilder.Entity<TicketWorkSession>()
                .HasOne(s => s.Ticket)
                .WithMany(t => t.WorkSessions)
                .HasForeignKey(s => s.TicketID)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<TicketWorkSession>()
                .HasOne(s => s.AgentUser)
                .WithMany()
                .HasForeignKey(s => s.AgentUserID)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<TicketWorkSession>()
                .HasIndex(s => s.TicketID)
                .IsUnique()
                .HasFilter("[EndedAt] IS NULL");

            modelBuilder.Entity<TicketActivityLog>()
                .HasOne(l => l.Ticket)
                .WithMany(t => t.ActivityLogs)
                .HasForeignKey(l => l.TicketID)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<TicketActivityLog>()
                .HasOne(l => l.PerformedByUser)
                .WithMany()
                .HasForeignKey(l => l.PerformedByUserID)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
