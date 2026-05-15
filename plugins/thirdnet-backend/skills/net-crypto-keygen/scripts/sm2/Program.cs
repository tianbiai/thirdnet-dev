using System;
using Org.BouncyCastle.Asn1.GM;
using Org.BouncyCastle.Crypto;
using Org.BouncyCastle.Crypto.Generators;
using Org.BouncyCastle.Crypto.Parameters;
using Org.BouncyCastle.Math.EC;
using Org.BouncyCastle.Security;

public class Program
{
    public static void Main()
    {
        var spec = GMNamedCurves.GetByName("SM2P256V1");
        var domainParams = new ECDomainParameters(spec.Curve, spec.G, spec.N, spec.H, spec.GetSeed());
        var keyGen = new ECKeyPairGenerator("EC");
        keyGen.Init(new ECKeyGenerationParameters(domainParams, new SecureRandom()));
        var keyPair = keyGen.GenerateKeyPair();

        var privateKey = ((ECPrivateKeyParameters)keyPair.Private).D.ToByteArrayUnsigned();
        var publicKey = ((ECPublicKeyParameters)keyPair.Public).Q.GetEncoded(false);

        Console.WriteLine("  \"public_key\": \"" + Convert.ToBase64String(publicKey) + "\",");
        Console.WriteLine("  \"private_key\": \"" + Convert.ToBase64String(privateKey) + "\",");
        Console.WriteLine("  \"type\": \"SM2\"");
    }
}
