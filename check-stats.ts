import { supabase } from './src/lib/supabase';

async function checkStats() {
    const allChunks: any[] = [];
    let from = 0;
    const step = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('chunks')
            .select('mmp_name')
            .range(from, from + step - 1);

        if (error) break;
        if (!data || data.length === 0) break;

        allChunks.push(...data);
        from += step;
    }

    const allDocs: any[] = [];
    from = 0;
    while (true) {
        const { data, error } = await supabase
            .from('documents')
            .select('mmp_name')
            .range(from, from + step - 1);

        if (error) break;
        if (!data || data.length === 0) break;

        allDocs.push(...data);
        from += step;
    }

    const dStats = allDocs.reduce((acc: any, d) => {
        acc[d.mmp_name] = (acc[d.mmp_name] || 0) + 1;
        return acc;
    }, {});

    const cStats = allChunks.reduce((acc: any, c) => {
        acc[c.mmp_name] = (acc[c.mmp_name] || 0) + 1;
        return acc;
    }, {});

    console.log('=== Document Stats ===');
    console.log(JSON.stringify(dStats, null, 2));
    console.log('\n=== Chunk Stats ===');
    console.log(JSON.stringify(cStats, null, 2));
}

checkStats();
