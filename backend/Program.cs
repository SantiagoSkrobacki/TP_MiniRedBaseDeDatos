using System.Globalization;
using System.Text.Json;
using Microsoft.AnalysisServices.AdomdClient;

var builder = WebApplication.CreateBuilder(args);
builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    o.SerializerOptions.WriteIndented = false;
});
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));
builder.Services.AddSingleton<DashboardService>();

var app = builder.Build();
app.Use(async (context, next) =>
{
    context.Response.Headers.Append("Access-Control-Allow-Private-Network", "true");
    await next();
});
app.UseCors();

app.MapGet("/api/health", (DashboardService service) =>
{
    try
    {
        var metrics = service.CheckHealth();
        return Results.Ok(new
        {
            status = "ok",
            server = service.Server,
            database = service.Database,
            cube = service.Cube,
            metrics
        });
    }
    catch (Exception ex)
    {
        return Results.Json(new { status = "error", error = ex.Message }, statusCode: 503);
    }
});

app.MapGet("/api/dashboard", async (DashboardService service) =>
{
    try
    {
        return Results.Json(await service.GetDashboardAsync());
    }
    catch (Exception ex)
    {
        return Results.Json(new { status = "error", error = ex.Message }, statusCode: 503);
    }
});

app.Run();

sealed class DashboardService(IConfiguration configuration)
{
    readonly object cacheLock = new();
    Task<Dashboard>? cached;

    public string Server { get; } = configuration["AnalysisServices:Server"] ?? "localhost\\SSAS";
    public string Database { get; } = configuration["AnalysisServices:Database"] ?? "Cubo_MiniRed_Logistica";
    public string Cube { get; } = configuration["AnalysisServices:Cube"] ?? "MiniRed Logistica";
    string ConnectionString => $"Data Source={Server};Catalog={Database};Integrated Security=SSPI;";

    public HealthMetrics CheckHealth()
    {
        using var connection = new AdomdConnection(ConnectionString);
        connection.Open();
        var mdx = $@"
SELECT {{
 [Measures].[Stock Disponible], [Measures].[Cantidad Vendida Stock],
 [Measures].[Cantidad Vendida Ventas], [Measures].[Tickets], [Measures].[Observaciones]
}} ON 0
FROM [{Cube}]
WHERE ([Sucursal].[Tipo Ubicacion].&[Sucursal])";
        using var command = new AdomdCommand(mdx, connection);
        using var reader = command.ExecuteReader();
        if (!reader.Read()) throw new InvalidOperationException("El cubo no devolvio medidas de control.");
        return new(Long(reader, 0), Long(reader, 1), Long(reader, 2), Long(reader, 3), Long(reader, 4));
    }

    public Task<Dashboard> GetDashboardAsync()
    {
        lock (cacheLock)
            return cached ??= Task.Run(BuildDashboard);
    }

    Dashboard BuildDashboard()
    {
        try
        {
            using var connection = new AdomdConnection(ConnectionString);
            connection.Open();
            var branches = ReadBranches(connection);
            var products = ReadProducts(connection);
            var facts = ReadFacts(connection, branches, products);
            if (facts.Count == 0) throw new InvalidOperationException("El cubo no devolvio observaciones de sucursales.");
            return Aggregate(facts, branches, products);
        }
        catch
        {
            lock (cacheLock) cached = null;
            throw;
        }
    }

    Dictionary<string, BranchInfo> ReadBranches(AdomdConnection connection)
    {
        var mdx = $@"
SELECT {{[Measures].[Observaciones]}} ON 0,
NON EMPTY ([Sucursal].[Nombre Sucursal].[Nombre Sucursal].Members
 * [Sucursal].[Zona].[Zona].Members) ON 1
FROM [{Cube}]
WHERE ([Sucursal].[Tipo Ubicacion].&[Sucursal])";
        using var reader = Execute(connection, mdx);
        var result = new Dictionary<string, BranchInfo>(StringComparer.OrdinalIgnoreCase);
        while (reader.Read())
        {
            var name = Text(reader, 0);
            result[name] = new(name, Text(reader, 1), "Sucursal");
        }
        return result;
    }

    Dictionary<string, ProductInfo> ReadProducts(AdomdConnection connection)
    {
        var mdx = $@"
SELECT {{[Measures].[Observaciones]}} ON 0,
NON EMPTY ([Producto].[Nombre Producto].[Nombre Producto].Members
 * [Producto].[Categoria].[Categoria].Members
 * [Producto].[Rubro].[Rubro].Members
 * [Producto].[Proveedor].[Proveedor].Members
 * [Producto].[Dias Reposicion].[Dias Reposicion].Members) ON 1
FROM [{Cube}]
WHERE ([Sucursal].[Tipo Ubicacion].&[Sucursal])";
        using var reader = Execute(connection, mdx);
        var result = new Dictionary<string, ProductInfo>(StringComparer.OrdinalIgnoreCase);
        while (reader.Read())
        {
            var name = Text(reader, 0);
            result[name] = new(name, Text(reader, 1), Text(reader, 2), Text(reader, 3), Convert.ToInt32(Value(reader, 4), CultureInfo.InvariantCulture));
        }
        return result;
    }

    List<FactRow> ReadFacts(AdomdConnection connection, Dictionary<string, BranchInfo> branches, Dictionary<string, ProductInfo> products)
    {
        var mdx = $@"
SELECT NON EMPTY {{
 [Measures].[Observaciones], [Measures].[Es Quiebre], [Measures].[Es Bajo Minimo],
 [Measures].[Es Sobrestock], [Measures].[Cantidad Vendida Stock],
 [Measures].[Stock Suma Tecnica], [Measures].[Valor Inventario]
}} ON 0,
NON EMPTY ([Tiempo].[Fecha].[Fecha].Members
 * [Sucursal].[Nombre Sucursal].[Nombre Sucursal].Members
 * [Producto].[Nombre Producto].[Nombre Producto].Members) ON 1
FROM [{Cube}]
WHERE ([Sucursal].[Tipo Ubicacion].&[Sucursal])";
        using var reader = Execute(connection, mdx);
        var result = new List<FactRow>(132_000);
        while (reader.Read())
        {
            var branchName = Text(reader, 1);
            var productName = Text(reader, 2);
            if (!branches.TryGetValue(branchName, out var branch) || !products.TryGetValue(productName, out var product))
                throw new InvalidOperationException($"No se pudo resolver la dimension para {branchName} / {productName}.");
            result.Add(new(
                ParseDate(Value(reader, 0)), branch, product,
                Long(reader, 3), Long(reader, 4), Long(reader, 5), Long(reader, 6),
                Long(reader, 7), DecimalValue(reader, 8), DecimalValue(reader, 9)));
        }
        return result;
    }

    static AdomdDataReader Execute(AdomdConnection connection, string mdx)
        => new AdomdCommand(mdx, connection) { CommandTimeout = 120 }.ExecuteReader();

    static Dashboard Aggregate(List<FactRow> facts, Dictionary<string, BranchInfo> branches, Dictionary<string, ProductInfo> products)
    {
        var first = facts.Min(x => x.Date);
        var last = facts.Max(x => x.Date);

        var serie = facts.GroupBy(x => new { x.Date.Year, x.Date.Month, x.Branch.Zone, x.Product.Category })
            .Select(g => new SerieRow(g.Key.Year, g.Key.Month, MonthName(g.Key.Month), g.Key.Zone, g.Key.Category,
                g.Sum(x => x.Obs), g.Sum(x => x.Breaks), g.Sum(x => x.Units), Round2(g.Sum(x => x.Stock) / g.Sum(x => x.Obs))))
            .OrderBy(x => x.anio).ThenBy(x => x.mes).ThenBy(x => x.zona).ThenBy(x => x.categoria).ToList();

        var sucursales = facts.GroupBy(x => new { x.Branch.Name, x.Branch.Zone, x.Product.Category })
            .Select(g =>
            {
                var latest = g.Where(x => x.Date == last).ToList();
                var obs = g.Sum(x => x.Obs);
                return new BranchRow(g.Key.Name, g.Key.Zone, g.Key.Category, obs, g.Sum(x => x.Breaks), g.Sum(x => x.Low),
                    g.Sum(x => x.Units), Round2(g.Sum(x => x.Stock) / obs), Round2((decimal)g.Sum(x => x.Units) / obs),
                    Round2(latest.Sum(x => x.Inventory)), latest.Sum(x => x.Low), latest.Sum(x => x.Obs));
            }).OrderBy(x => x.sucursal).ThenBy(x => x.categoria).ToList();

        var productos = facts.GroupBy(x => new { x.Product.Name, x.Product.Category, x.Product.Rubro, x.Product.Provider, x.Product.ReplenishmentDays, x.Branch.Zone })
            .Select(g => new ProductRow(g.Key.Name, g.Key.Category, g.Key.Rubro, g.Key.Provider, g.Key.ReplenishmentDays, g.Key.Zone,
                g.Sum(x => x.Obs), g.Sum(x => x.Breaks), g.Sum(x => x.Units), Round2(g.Where(x => x.Date == last).Sum(x => x.Inventory))))
            .OrderBy(x => x.producto).ThenBy(x => x.zona).ToList();

        var porDia = facts.GroupBy(x => new { x.Date.DayOfWeek, x.Branch.Zone, x.Product.Category })
            .Select(g => new DayRow(DayName(g.Key.DayOfWeek), DayOrder(g.Key.DayOfWeek), g.Key.Zone, g.Key.Category,
                g.Sum(x => x.Obs), g.Sum(x => x.Breaks)))
            .OrderBy(x => x.orden).ThenBy(x => x.zona).ThenBy(x => x.categoria).ToList();

        var proveedores = facts.GroupBy(x => x.Product.Provider)
            .Select(g =>
            {
                var outsideWest = g.Where(x => !x.Branch.Zone.Equals("Oeste", StringComparison.OrdinalIgnoreCase)).ToList();
                return new ProviderRow(g.Key, g.First().Product.Category, g.First().Product.ReplenishmentDays,
                    Percent(g.Sum(x => x.Breaks), g.Sum(x => x.Obs)), Percent(outsideWest.Sum(x => x.Breaks), outsideWest.Sum(x => x.Obs)));
            }).OrderByDescending(x => x.tasaGlobal).ToList();

        var reglas = new List<RuleRow>
        {
            Rule("R1", "Bebidas en zona Oeste", "Reforzar la reposicion de bebidas en el Oeste antes del fin de semana",
                facts.Where(x => x.Product.Category == "Bebidas"), x => x.Branch.Zone == "Oeste", x => x.Breaks),
            Rule("R2", "Proveedor Arcor, ciclo de 14 dias", "Renegociar frecuencia de entrega con Arcor o subir el nivel objetivo",
                facts.Where(x => x.Product.Category != "Bebidas"), x => x.Product.Provider == "Arcor", x => x.Breaks),
            Rule("R3", "Congelados en verano", "Nivel objetivo estacional para congelados entre diciembre y febrero",
                facts.Where(x => x.Product.Category == "Congelados"), x => IsSummer(x.Date.Month), x => x.Breaks),
            Rule("R4", "Sobrestock en San Justo", "Recalibrar el nivel objetivo de San Justo a su demanda real",
                facts, x => x.Branch.Name == "San Justo", x => x.Overstock)
        };

        return new(
            new(DateTime.Now.ToString("s"), first.ToString("yyyy-MM-dd"), last.ToString("yyyy-MM-dd"), last.ToString("yyyy-MM-dd"),
                facts.Select(x => x.Date).Distinct().Count(), branches.Values.Count(x => x.Type == "Sucursal"), products.Count, facts.Sum(x => x.Obs)),
            serie, sucursales, productos, porDia, proveedores, reglas);
    }

    static RuleRow Rule(string id, string text, string action, IEnumerable<FactRow> source,
        Func<FactRow, bool> antecedent, Func<FactRow, long> consequent)
    {
        var rows = source.ToList();
        long cases = rows.Sum(x => x.Obs);
        long ant = rows.Where(antecedent).Sum(x => x.Obs);
        long con = rows.Sum(consequent);
        long both = rows.Where(antecedent).Sum(consequent);
        decimal confidence = Ratio(both, ant);
        decimal baseRate = Ratio(con, cases);
        decimal ConfFor(int year)
        {
            var selected = rows.Where(x => x.Date.Year == year && antecedent(x)).ToList();
            return Percent(selected.Sum(consequent), selected.Sum(x => x.Obs));
        }
        return new(id, text, action, cases, ant, Percent(both, cases), Percent(both, ant), Percent(con, cases),
            baseRate == 0 ? 0 : Round2(confidence / baseRate), ConfFor(2024), ConfFor(2025));
    }

    static object Value(AdomdDataReader reader, int index) => reader.IsDBNull(index) ? 0 : reader.GetValue(index);
    static string Text(AdomdDataReader reader, int index) => Convert.ToString(Value(reader, index), CultureInfo.InvariantCulture) ?? "";
    static long Long(AdomdDataReader reader, int index) => Convert.ToInt64(Value(reader, index), CultureInfo.InvariantCulture);
    static decimal DecimalValue(AdomdDataReader reader, int index) => Convert.ToDecimal(Value(reader, index), CultureInfo.InvariantCulture);
    static DateTime ParseDate(object value)
    {
        if (value is DateTime date) return date.Date;
        var text = Convert.ToString(value, CultureInfo.InvariantCulture) ?? "";
        if (DateTime.TryParse(text, CultureInfo.GetCultureInfo("es-AR"), DateTimeStyles.None, out date)) return date.Date;
        if (DateTime.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.None, out date)) return date.Date;
        throw new FormatException($"Fecha de SSAS no reconocida: {text}");
    }
    static decimal Ratio(long numerator, long denominator) => denominator == 0 ? 0 : (decimal)numerator / denominator;
    static decimal Percent(long numerator, long denominator) => Round2(100 * Ratio(numerator, denominator));
    static decimal Round2(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);
    static bool IsSummer(int month) => month is 12 or 1 or 2;
    static string MonthName(int month) => CultureInfo.GetCultureInfo("es-AR").DateTimeFormat.GetMonthName(month) is var n
        ? char.ToUpperInvariant(n[0]) + n[1..] : "";
    static int DayOrder(DayOfWeek day) => day == DayOfWeek.Sunday ? 6 : (int)day - 1;
    static string DayName(DayOfWeek day) => day switch
    {
        DayOfWeek.Monday => "Lunes", DayOfWeek.Tuesday => "Martes", DayOfWeek.Wednesday => "Miercoles",
        DayOfWeek.Thursday => "Jueves", DayOfWeek.Friday => "Viernes", DayOfWeek.Saturday => "Sabado", _ => "Domingo"
    };
}

sealed record BranchInfo(string Name, string Zone, string Type);
sealed record ProductInfo(string Name, string Category, string Rubro, string Provider, int ReplenishmentDays);
sealed record FactRow(DateTime Date, BranchInfo Branch, ProductInfo Product, long Obs, long Breaks, long Low, long Overstock, long Units, decimal Stock, decimal Inventory);
sealed record HealthMetrics(long stockDisponible, long cantidadVendidaStock, long cantidadVendidaVentas, long tickets, long observaciones);
sealed record Meta(string generado, string desde, string hasta, string ultimaFecha, int dias, int sucursales, int productos, long observaciones);
sealed record SerieRow(int anio, int mes, string mesNombre, string zona, string categoria, long observaciones, long quiebres, long unidades, decimal stock);
sealed record BranchRow(string sucursal, string zona, string categoria, long observaciones, long quiebres, long bajoMinimo, long unidades, decimal stockProm, decimal ventaProm, decimal valorInv, long reposPend, long combinaciones);
sealed record ProductRow(string producto, string categoria, string rubro, string proveedor, int diasRepos, string zona, long observaciones, long quiebres, long unidades, decimal valorInv);
sealed record DayRow(string dia, int orden, string zona, string categoria, long observaciones, long quiebres);
sealed record ProviderRow(string proveedor, string categoria, int diasRepos, decimal tasaGlobal, decimal tasaSinOeste);
sealed record RuleRow(string id, string regla, string accion, long casos, long antecedente, decimal soporte, decimal confianza, decimal @base, decimal lift, decimal conf2024, decimal conf2025);
sealed record Dashboard(Meta meta, List<SerieRow> serie, List<BranchRow> sucursales, List<ProductRow> productos, List<DayRow> porDiaSemana, List<ProviderRow> proveedores, List<RuleRow> reglas);
