
import { instantiate, Node, Prefab } from 'cc';
import { BundleManager } from '../BundleManager/BundleManager';

export interface IUIController {
    OnOpen?(root:Node, data?:unknown):void;
    OnClose?():void;
}

type UIControllerCreator = () => IUIController;

export class UIManager {
    private parent:Node|null = null;
    private pageRequestVersion:number = 0;
    private boraderRequestVersion:number = 0;
    private openingPageName:string = "";
    private openingBoraderName:string = "";

    public CurrPageName:string = "";
    public CurrPage:Node|null = null;
    private currPageController:IUIController|null = null;

    private currBorader:Node|null = null;
    public currboraderName:string = "";
    private currBoraderController:IUIController|null = null;

    private pageControllerCreators:Map<string, UIControllerCreator> = new Map();
    private boraderControllerCreators:Map<string, UIControllerCreator> = new Map();

    public static instance:UIManager;
    static get Instance():UIManager {
        if(this.instance==null)
            this.instance=new UIManager();
        return this.instance;
    }

    public Init(parent:Node) {
        this.parent = parent;
    }

    public RegisterPageController(pageName:string, creator:UIControllerCreator) {
        this.pageControllerCreators.set(pageName, creator);
    }

    public RegisterBoraderController(boraderName:string, creator:UIControllerCreator) {
        this.boraderControllerCreators.set(boraderName, creator);
    }

    /**
     * 异步加载页面资源，返回 Prefab。不切换当前页面，不修改任何 UI 状态。
     * 调用方拿到 Prefab 后，在合适的时机（如玩家点击回调中）调用 ShowPage 同步展示。
     * 若资源已缓存，Promise 立即 resolve，无等待。
     */
    public async LoadPage(pageName:string, bundleName:string): Promise<Prefab> {
        return await BundleManager.Instance.LoadAssetsFromBundle(bundleName, pageName) as Prefab;
    }

    /**
     * 同步展示页面。需先通过 LoadPage 获取 Prefab。
     * 因为是同步操作，页面在调用时立即创建展示，不会出现异步回调中页面在不适当场景弹出的问题。
     */
    public ShowPage(pageName:string, prefab:Prefab, data?:unknown): void {
        if(this.CurrPageName == pageName) {
            console.warn("当前页面已打开:"+pageName);
            return;
        }

        if (!this.parent) {
            throw new Error("UIManager.ShowPage failed: parent is not initialized");
        }

        const old = this.CurrPage;
        const oldPageName = this.CurrPageName;
        const oldController = this.currPageController;

        const node = instantiate(prefab);
        node.setParent(this.parent);

        const controller = this.CreatePageController(pageName);
        try {
            controller?.OnOpen?.(node, data);
        }
        catch (err) {
            console.error("UIManager.ShowPage controller OnOpen failed:", pageName, err);
            node.destroy();
            return;
        }

        this.CloseBorader();
        this.CurrPage = node;
        this.CurrPageName = pageName;
        this.currPageController = controller;

        this.CloseController(oldController, oldPageName);
        if(old) {
            old.destroy();
        }
    }

    /**
     * 异步加载 Borader 资源，返回 Prefab。不切换当前界面，不修改任何 UI 状态。
     */
    public async LoadBorader(boraderName:string, bundleName:string): Promise<Prefab> {
        return await BundleManager.Instance.LoadAssetsFromBundle(bundleName, boraderName) as Prefab;
    }

    /**
     * 同步展示 Borader。需先通过 LoadBorader 获取 Prefab。
     * 因为是同步操作，不会出现异步回调中界面在不适当场景弹出的问题。
     */
    public ShowBorader(boraderName:string, prefab:Prefab, data?:unknown): void {
        if(this.currboraderName == boraderName) {
            console.warn("当前界面已打开:"+boraderName);
            return;
        }

        if (!this.CurrPage) {
            throw new Error(`UIManager.ShowBorader failed: current page is unavailable for ${boraderName}`);
        }

        const old = this.currBorader;
        const oldBoraderName = this.currboraderName;
        const oldController = this.currBoraderController;

        const node = instantiate(prefab);
        node.setParent(this.CurrPage);

        const controller = this.CreateBoraderController(boraderName);
        try {
            controller?.OnOpen?.(node, data);
        }
        catch (err) {
            console.error("UIManager.ShowBorader controller OnOpen failed:", boraderName, err);
            node.destroy();
            return;
        }

        this.currBorader = node;
        this.currboraderName = boraderName;
        this.currBoraderController = controller;

        this.CloseController(oldController, oldBoraderName);
        if(old) {
            old.destroy();
        }
    }
    
    public async OpenPage(pageName:string, bundleName:string, data?:unknown) {
        if(this.CurrPageName == pageName || this.openingPageName == pageName) {
            console.warn("当前页面已打开或正在打开:"+pageName);
            return;
        }

        if (!this.parent) {
            throw new Error("UIManager.OpenPage failed: parent is not initialized");
        }

        const requestVersion = ++this.pageRequestVersion;
        this.openingPageName = pageName;
        const old = this.CurrPage;
        const oldPageName = this.CurrPageName;
        const oldController = this.currPageController;

        try {
            let bundle = await BundleManager.Instance.LoadAssetsFromBundle(bundleName, pageName) as Prefab;
            if (requestVersion !== this.pageRequestVersion) {
                return;
            }

            let node = instantiate(bundle);
            node.setParent(this.parent);
            const controller = this.CreatePageController(pageName);
            try {
                controller?.OnOpen?.(node, data);
            }
            catch (err) {
                console.error("UIManager.OpenPage controller OnOpen failed:", pageName, err);
                node.destroy();
                return;
            }

            if (requestVersion !== this.pageRequestVersion) {
                this.CloseController(controller, pageName);
                node.destroy();
                return;
            }

            this.CloseBorader();
            this.CurrPage = node;
            this.CurrPageName = pageName;
            this.currPageController = controller;

            this.CloseController(oldController, oldPageName);
            if(old) {
                old.destroy();
            }
        }
        catch (err) {
            console.error("UIManager.OpenPage failed:", pageName, err);
        }
        finally {
            if (requestVersion === this.pageRequestVersion) {
                this.openingPageName = "";
            }
        }
    }

    public ClosePage() {
        this.pageRequestVersion++;
        this.boraderRequestVersion++;
        this.openingPageName = "";
        this.CloseBorader();
        this.CloseController(this.currPageController, this.CurrPageName);
        this.currPageController = null;
        if(this.CurrPage) {
            this.CurrPage.destroy();
            this.CurrPage = null;
            this.CurrPageName = "";
        }
    }

    public async OpenBorader(boraderName:string, bundleName:string, data?:unknown) {
        if(this.currboraderName == boraderName || this.openingBoraderName == boraderName) {
            console.warn("当前界面已打开或正在打开:"+boraderName);
            return;
        }

        if (!this.CurrPage) {
            throw new Error(`UIManager.OpenBorader failed: current page is unavailable for ${boraderName}`);
        }

        const requestVersion = ++this.boraderRequestVersion;
        this.openingBoraderName = boraderName;
        const parentPage = this.CurrPage;
        let old = this.currBorader;
        const oldBoraderName = this.currboraderName;
        const oldController = this.currBoraderController;

        try {
            let bundle = await BundleManager.Instance.LoadAssetsFromBundle(bundleName, boraderName) as Prefab;
            if (requestVersion !== this.boraderRequestVersion) {
                return;
            }

            if (!this.CurrPage || this.CurrPage !== parentPage) {
                throw new Error(`UIManager.OpenBorader failed: current page changed while opening ${boraderName}`);
            }

            let node = instantiate(bundle);
            node.setParent(this.CurrPage);
            const controller = this.CreateBoraderController(boraderName);
            try {
                controller?.OnOpen?.(node, data);
            }
            catch (err) {
                console.error("UIManager.OpenBorader controller OnOpen failed:", boraderName, err);
                node.destroy();
                return;
            }

            if (requestVersion !== this.boraderRequestVersion) {
                this.CloseController(controller, boraderName);
                node.destroy();
                return;
            }

            this.currBorader = node;
            this.currboraderName = boraderName;
            this.currBoraderController = controller;

            this.CloseController(oldController, oldBoraderName);
            if(old) {
                old.destroy();
            }
        }
        catch (err) {
            console.error("UIManager.OpenBorader failed:", boraderName, err);
        }
        finally {
            if (requestVersion === this.boraderRequestVersion) {
                this.openingBoraderName = "";
            }
        }
    }

    public CloseBorader() {
        this.boraderRequestVersion++;
        this.openingBoraderName = "";
        this.CloseController(this.currBoraderController, this.currboraderName);
        this.currBoraderController = null;
        if(this.currBorader) {
            this.currBorader.destroy();
            this.currBorader = null;
            this.currboraderName = "";
        }
    }

    private CreatePageController(pageName:string) {
        const creator = this.pageControllerCreators.get(pageName);
        return creator ? creator() : null;
    }

    private CreateBoraderController(boraderName:string) {
        const creator = this.boraderControllerCreators.get(boraderName);
        return creator ? creator() : null;
    }

    private CloseController(controller:IUIController|null, uiName:string) {
        if (!controller) {
            return;
        }

        try {
            controller.OnClose?.();
        }
        catch (err) {
            console.error("UIManager controller OnClose failed:", uiName, err);
        }
    }
}
