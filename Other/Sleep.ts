export function Sleep(ms: number): Promise<void> 
{
    return new Promise((resolve) => 
    {
        let st = setTimeout(() => 
        {
            clearTimeout(st);
            resolve();
        }, ms);
    });
}

export function Delay(ms: number, release: () => void): Promise<void> 
{
    return new Promise((resolve) =>
    {
        let st = setTimeout(async () =>
        {
            clearTimeout(st);
            await release();
            resolve();
        }, ms);
    });
}