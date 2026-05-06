
import { _decorator, Animation, animation, Asset, Component, instantiate, Node, TTFFont, Prefab, resources, RichText, primitives, AudioSource, builtinResMgr, Canvas, Scene, Pool, error, input, Input, EventTouch, Vec2, Vec3, Camera, find } from 'cc';
import { BundleManager } from '../BundleManager/BundleManager';

export class UIManager {
    private parent:Node|null = null;
    private pageRequestVersion:number = 0;
    private boraderRequestVersion:number = 0;

    public CurrPageName:string = "";
    public CurrPage:Node|null = null;

    private currBorader:Node|null = null;
    public currboraderName:string = "";

    public static instance:UIManager;
    static get Instance():UIManager {
        if(this.instance==null)
            this.instance=new UIManager();
        return this.instance;
    }

    public Init(parent:Node) {
        this.parent = parent;
    }
    
    public async OpenPage(pageName:string, bundleName:string) {
        if(this.CurrPageName == pageName) {
            console.warn("当前页面已打开:"+pageName);
            return;
        }

        if (!this.parent) {
            throw new Error("UIManager.OpenPage failed: parent is not initialized");
        }

        const requestVersion = ++this.pageRequestVersion;
        let old = this.CurrPage;

        let bundle = await BundleManager.Instance.LoadAssetsFromBundle(bundleName, pageName) as Prefab;
        if (requestVersion !== this.pageRequestVersion) {
            return;
        }

        let node = instantiate(bundle);
        node.setParent(this.parent);
        this.CurrPage = node;
        this.CurrPageName = pageName;
        this.currBorader = null;
        this.currboraderName = "";

        if(old) {
            old.destroy();
        }
    }

    public ClosePage() {
        this.pageRequestVersion++;
        this.boraderRequestVersion++;
        this.CloseBorader();
        if(this.CurrPage) {
            this.CurrPage.destroy();
            this.CurrPage = null;
            this.CurrPageName = "";
        }
    }

    public async OpenBorader(boraderName:string, bundleName:string) {
        if(this.currboraderName == boraderName) {
            console.warn("当前界面已打开:"+boraderName);
            return;
        }

        if (!this.CurrPage) {
            throw new Error(`UIManager.OpenBorader failed: current page is unavailable for ${boraderName}`);
        }

        const requestVersion = ++this.boraderRequestVersion;
        const parentPage = this.CurrPage;
        let old = this.currBorader;

        let bundle = await BundleManager.Instance.LoadAssetsFromBundle(bundleName, boraderName) as Prefab;
        if (requestVersion !== this.boraderRequestVersion) {
            return;
        }

        if (!this.CurrPage || this.CurrPage !== parentPage) {
            throw new Error(`UIManager.OpenBorader failed: current page changed while opening ${boraderName}`);
        }

        let node = instantiate(bundle);
        node.setParent(this.CurrPage);
        this.currBorader = node;
        this.currboraderName = boraderName;

        if(old) {
            old.destroy();
        }
    }

    public CloseBorader() {
        this.boraderRequestVersion++;
        if(this.currBorader) {
            this.currBorader.destroy();
            this.currBorader = null;
            this.currboraderName = "";
        }
    }
}
