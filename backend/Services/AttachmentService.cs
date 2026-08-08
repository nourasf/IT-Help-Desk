using backend.Data;
using backend.Models;
using Microsoft.AspNetCore.Http;

namespace backend.Services;

public class AttachmentService
{
    public const int MaxFilesPerUpload = 5;
    public const long MaxImageBytes = 5 * 1024 * 1024;
    public const long MaxDocumentBytes = 10 * 1024 * 1024;
    public const long MaxRequestBytes = 20 * 1024 * 1024;

    private static readonly HashSet<string> ImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp"
    };

    private static readonly HashSet<string> DocumentExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt"
    };

    private readonly AppDbContext _context;
    private readonly IWebHostEnvironment _environment;

    public AttachmentService(AppDbContext context, IWebHostEnvironment environment)
    {
        _context = context;
        _environment = environment;
    }

    public async Task<List<FileAttachment>> SaveAsync(
        int ticketId,
        int uploadedByUserId,
        IReadOnlyCollection<IFormFile> files,
        int? ticketCommentId = null)
    {
        if (files.Count == 0)
        {
            throw new InvalidOperationException("Please select at least one file.");
        }

        if (files.Count > MaxFilesPerUpload)
        {
            throw new InvalidOperationException($"You can upload at most {MaxFilesPerUpload} files at once.");
        }

        if (files.Sum(file => file.Length) > MaxRequestBytes)
        {
            throw new InvalidOperationException("The combined upload size cannot exceed 20 MB.");
        }

        var savedFiles = new List<FileAttachment>();
        var writtenPaths = new List<string>();

        try
        {
            foreach (var file in files)
            {
                ValidateFile(file);

                var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
                var storedFileName = $"{Guid.NewGuid():N}{extension}";
                var relativeDirectory = Path.Combine("tickets", ticketId.ToString());
                var absoluteDirectory = Path.Combine(_environment.ContentRootPath, "uploads", relativeDirectory);
                Directory.CreateDirectory(absoluteDirectory);

                var absolutePath = Path.Combine(absoluteDirectory, storedFileName);

                await using (var stream = new FileStream(
                    absolutePath,
                    FileMode.CreateNew,
                    FileAccess.Write,
                    FileShare.None,
                    81920,
                    useAsync: true))
                {
                    await file.CopyToAsync(stream);
                }

                writtenPaths.Add(absolutePath);

                var attachment = new FileAttachment
                {
                    OriginalFileName = Path.GetFileName(file.FileName),
                    StoredFileName = storedFileName,
                    FilePath = Path.Combine(relativeDirectory, storedFileName).Replace('\\', '/'),
                    ContentType = string.IsNullOrWhiteSpace(file.ContentType)
                        ? "application/octet-stream"
                        : file.ContentType,
                    FileSize = file.Length,
                    UploadedAt = DateTime.UtcNow,
                    UploadedByUserId = uploadedByUserId,
                    TicketId = ticketId,
                    TicketCommentId = ticketCommentId
                };

                _context.FileAttachments.Add(attachment);
                savedFiles.Add(attachment);
            }

            await _context.SaveChangesAsync();
            return savedFiles;
        }
        catch
        {
            foreach (var path in writtenPaths)
            {
                if (File.Exists(path))
                {
                    File.Delete(path);
                }
            }

            throw;
        }
    }

    public string GetAbsolutePath(FileAttachment attachment)
    {
        var uploadsRoot = Path.GetFullPath(Path.Combine(_environment.ContentRootPath, "uploads"));
        var absolutePath = Path.GetFullPath(Path.Combine(uploadsRoot, attachment.FilePath));

        if (!absolutePath.StartsWith(uploadsRoot, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Invalid attachment path.");
        }

        return absolutePath;
    }

    private static void ValidateFile(IFormFile file)
    {
        if (file.Length <= 0)
        {
            throw new InvalidOperationException($"{file.FileName} is empty.");
        }

        var extension = Path.GetExtension(file.FileName);

        if (!ImageExtensions.Contains(extension) && !DocumentExtensions.Contains(extension))
        {
            throw new InvalidOperationException(
                $"{file.FileName} is not an allowed file type. Allowed types: JPG, JPEG, PNG, WEBP, PDF, DOC, DOCX, XLS, XLSX and TXT.");
        }

        var maxBytes = ImageExtensions.Contains(extension)
            ? MaxImageBytes
            : MaxDocumentBytes;

        if (file.Length > maxBytes)
        {
            var maxMb = maxBytes / 1024 / 1024;
            throw new InvalidOperationException($"{file.FileName} exceeds the {maxMb} MB file limit.");
        }

        using var stream = file.OpenReadStream();
        Span<byte> header = stackalloc byte[8];
        var bytesRead = stream.Read(header);

        if (!MatchesSignature(extension, header[..bytesRead]))
        {
            throw new InvalidOperationException($"{file.FileName} does not match its file extension.");
        }
    }

    private static bool MatchesSignature(string extension, ReadOnlySpan<byte> header)
    {
        extension = extension.ToLowerInvariant();

        if (extension == ".txt")
        {
            return true;
        }

        if (extension is ".jpg" or ".jpeg")
        {
            return header.Length >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF;
        }

        if (extension == ".png")
        {
            return header.Length >= 8 &&
                   header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E && header[3] == 0x47 &&
                   header[4] == 0x0D && header[5] == 0x0A && header[6] == 0x1A && header[7] == 0x0A;
        }

        if (extension == ".webp")
        {
            return header.Length >= 4 && header[0] == 0x52 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x46;
        }

        if (extension == ".pdf")
        {
            return header.Length >= 4 && header[0] == 0x25 && header[1] == 0x50 && header[2] == 0x44 && header[3] == 0x46;
        }

        if (extension is ".docx" or ".xlsx")
        {
            return header.Length >= 4 && header[0] == 0x50 && header[1] == 0x4B && header[2] == 0x03 && header[3] == 0x04;
        }

        if (extension is ".doc" or ".xls")
        {
            return header.Length >= 8 &&
                   header[0] == 0xD0 && header[1] == 0xCF && header[2] == 0x11 && header[3] == 0xE0 &&
                   header[4] == 0xA1 && header[5] == 0xB1 && header[6] == 0x1A && header[7] == 0xE1;
        }

        return false;
    }
}
