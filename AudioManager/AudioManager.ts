/*
 * 新建 AudioManager.ts
 * author: Hotaru
 * 2024/04/06
 */
import { _decorator, AudioClip, AudioSource, Component, director, Node, isValid } from 'cc';
import { BundleManager } from '../BundleManager/BundleManager';

export class AudioManager
{
    private parent:Node|null = null;
    private static instance:AudioManager|null = null;
    private static readonly audioNodeName = '__audioMgr__';
    private audioSource:AudioSource|null = null;
    private static readonly audioClips:Map<string, AudioClip> = new Map();

    public Init(parent:Node) {
        this.parent = parent;
        if (this.audioSource && isValid(this.audioSource.node)) {
            return;
        }

        const scene = director.getScene();
        if (!scene) {
            throw new Error('AudioManager.Init failed: scene is unavailable');
        }

        let audioMgr = scene.getChildByName(AudioManager.audioNodeName);
        if (!audioMgr || !isValid(audioMgr)) {
            audioMgr = new Node();
            audioMgr.name = AudioManager.audioNodeName;
            scene.addChild(audioMgr);
            director.addPersistRootNode(audioMgr);
        }

        this.audioSource = audioMgr.getComponent(AudioSource) ?? audioMgr.addComponent(AudioSource);
    }
    
    public static get Instance() {
        if(null == this.instance) {
            this.instance=new AudioManager();
        }
        return this.instance;
    }

    public get AudioSource() {
        return this.audioSource;
    }

    public async PlaySound(sound: AudioClip | string, volume: number = 1.0) {
        try {
            let clip = sound instanceof AudioClip ? sound : await this.FoundClips(sound);
            if (this.audioSource != null && clip != null) {
                this.audioSource.stop();
                this.audioSource.clip = clip;
                this.audioSource.play();
                this.audioSource.volume = volume;
            }
        }
       catch(error) {
            console.error('AudioManager 下 PlaySound 错误 err: ',error);
       }
    }

    public async PlayerOnShot(sound: AudioClip | string, volume: number = 1.0) {
        try {
            let clip = sound instanceof AudioClip ? sound : await this.FoundClips(sound);
            if (this.audioSource != null && clip != null) {
                this.audioSource.playOneShot(clip, volume);
            }
        }
        catch(error) {
            console.error('AudioManager 下 PlayerOnShot 错误 err: ',error);
        }
    }

    public Stop() {
        this.audioSource?.stop();
    }

    public Pause() {
        this.audioSource?.pause();
    }

    public Resume() {
        this.audioSource?.play();
    }

    private ParseClipPath(resource:string) {
        const splitIndex = resource.indexOf('/');
        if (splitIndex <= 0 || splitIndex >= resource.length - 1) {
            throw new Error(`AudioManager.FoundClips invalid resource path: ${resource}`);
        }

        return {
            bundleName: resource.slice(0, splitIndex),
            assetPath: resource.slice(splitIndex + 1),
            cacheKey: resource,
        };
    }

    private async FoundClips(_name:string) {
        const { bundleName, assetPath, cacheKey } = this.ParseClipPath(_name);
        const cachedClip = AudioManager.audioClips.get(cacheKey);
        if (cachedClip) {
            return cachedClip;
        }

        let clip = await BundleManager.Instance.LoadAssetsFromBundle(bundleName, assetPath) as AudioClip;
        AudioManager.audioClips.set(cacheKey, clip);

        return clip;
    }
}

