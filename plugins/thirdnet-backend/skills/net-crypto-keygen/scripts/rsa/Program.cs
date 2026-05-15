using System;
using System.Security.Cryptography;

public class Program
{
    public static void Main()
    {
        using var rsa = RSA.Create(2048);
        var publicKey = rsa.ExportSubjectPublicKeyInfo();
        var privateKey = rsa.ExportPkcs8PrivateKey();

        Console.WriteLine("  \"public_key\": \"" + Convert.ToBase64String(publicKey) + "\",");
        Console.WriteLine("  \"private_key\": \"" + Convert.ToBase64String(privateKey) + "\",");
        Console.WriteLine("  \"type\": \"RSA\"");
    }
}
