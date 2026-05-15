using System;
using System.Security.Cryptography;

public class Program
{
    public static void Main(string[] args)
    {
        // 参数：AES 或 SM4，默认 AES
        var algorithm = args.Length > 0 ? args[0].ToUpperInvariant() : "AES";

        // AES-128 / SM4 均使用 16 字节密钥 + 16 字节 IV
        var key = RandomNumberGenerator.GetBytes(16);
        var iv = RandomNumberGenerator.GetBytes(16);

        Console.WriteLine("  \"key\": \"" + Convert.ToBase64String(key) + "\",");
        Console.WriteLine("  \"iv\": \"" + Convert.ToBase64String(iv) + "\",");
        Console.WriteLine("  \"type\": \"" + algorithm + "\"");
    }
}
