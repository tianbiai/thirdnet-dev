# 复杂类型配置参考

JSONB 和数组类型的实体模型与 Fluent API 配置模式。

## JSONB 类型

用于存储 JSON 格式的复杂数据（嵌套对象或字典结构）。

```csharp
// 实体模型
public class OrderModel
{
    public long id { get; set; }
    public string order_no { get; set; }
    public ShippingAddress shipping_address { get; set; }       // 拥有类型（Owned Type）
    public Dictionary<string, object> extra_info { get; set; }  // 字典类型
}

// 嵌套对象（不需要单独建表）
public class ShippingAddress
{
    public string province { get; set; }
    public string city { get; set; }
    public string detail { get; set; }
}

// Fluent API 配置
public class OrderConfiguration : IEntityTypeConfiguration<OrderModel>
{
    public void Configure(EntityTypeBuilder<OrderModel> builder)
    {
        builder.ToTable("t_order", "order", t => t.HasComment("订单表"));
        builder.HasKey(x => x.id);

        // JSONB — 拥有类型（Owned Type）
        builder.OwnsOne(x => x.shipping_address, nav =>
        {
            nav.ToJson();
            nav.Property(x => x.province).HasComment("省份");
            nav.Property(x => x.city).HasComment("城市");
            nav.Property(x => x.detail).HasComment("详细地址");
        });

        // JSONB — 字典类型
        builder.Property(x => x.extra_info)
            .HasColumnType("jsonb")
            .HasComment("扩展信息");
    }
}
```

## 数组类型

用于存储 PostgreSQL 数组（`text[]`、`bigint[]` 等）。

```csharp
// 实体模型
public class ProductModel
{
    public long id { get; set; }
    public string name { get; set; }
    public List<string> tags { get; set; }         // 字符串数组
    public long[] category_ids { get; set; }       // 长整型数组
}

// Fluent API 配置
public class ProductConfiguration : IEntityTypeConfiguration<ProductModel>
{
    public void Configure(EntityTypeBuilder<ProductModel> builder)
    {
        builder.ToTable("t_product", "product", t => t.HasComment("商品表"));
        builder.HasKey(x => x.id);

        builder.Property(x => x.tags)
            .HasColumnType("text[]")
            .HasComment("商品标签");

        builder.Property(x => x.category_ids)
            .HasColumnType("bigint[]")
            .HasComment("分类ID列表");
    }
}
```
