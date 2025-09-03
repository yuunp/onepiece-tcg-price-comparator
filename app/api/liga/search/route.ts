// app/api/liga/search/route.ts
import { NextResponse } from "next/server";
import { LigaOnePieceScraper } from "@/scripts/liga-scraper";

// ✅ CRIAR INSTÂNCIA GLOBAL para evitar problemas de fechamento
let globalScraper: LigaOnePieceScraper | null = null;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json(
      { error: "Parâmetro 'q' é obrigatório" },
      { status: 400 }
    );
  }

  try {
    console.log(`🚀 Iniciando busca por: "${query}"`);
    
    // ✅ USAR INSTÂNCIA GLOBAL ou criar nova
    if (!globalScraper) {
      globalScraper = new LigaOnePieceScraper();
      await globalScraper.initialize();
      console.log("✅ Novo scraper inicializado");
    }

    const results = await globalScraper.searchCards(query);

    console.log(`✅ Busca concluída: ${results.length} resultados`);

    return NextResponse.json({
      query,
      count: results.length,
      results,
    });
  } catch (error: any) {
    console.error("❌ Erro no /api/liga/search:", error);
    
    // ✅ Resetar scraper em caso de erro
    if (globalScraper) {
      await globalScraper.close().catch(() => {});
      globalScraper = null;
    }
    
    return NextResponse.json(
      { 
        error: "Erro ao buscar no LigaOnePiece", 
        details: error.message
      },
      { status: 500 }
    );
  }
}

// ✅ Fechar scraper quando o servidor for desligado
process.on('SIGTERM', async () => {
  if (globalScraper) {
    await globalScraper.close();
  }
});