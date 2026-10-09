const assetPathPrefix = "https://www.figma.com/api/mcp/asset/b9912ec5-ea17-4930-adfe-042524922a2e";
const imgFrame = `${assetPathPrefix}/f0ea4.svg`;
const imgFrame1 = `${assetPathPrefix}/4ab7b.svg`;
const imgFrame2 = `${assetPathPrefix}/d4f14.svg`;
const imgFrame3 = `${assetPathPrefix}/239f2.svg`;
const imgFrame4 = `${assetPathPrefix}/bcb41.svg`;
const imgFrame5 = `${assetPathPrefix}/44e61.svg`;
const imgFrame6 = `${assetPathPrefix}/b5dc8.svg`;
const imgFrame7 = `${assetPathPrefix}/ff654.svg`;

type PusangGalaButtonProps = {
  className?: string;
  kind?: "Secondary";
  label?: string;
};

function PusangGalaButton({ className, kind = "Secondary", label = "Continue →" }: PusangGalaButtonProps) {
  return (
    <div className={className || "bg-[var(--pg-color-surface,#fff9ef)] border border-[var(--pg-color-border,#efdcca)] border-solid content-stretch flex h-[52px] items-center justify-center relative rounded-[var(--pg-radius-button,16px)] w-[350px]"} data-node-id="6:8">
      <p className="[word-break:break-word] font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-ink,#2e1c14)] whitespace-nowrap" data-node-id="6:9" style={{ fontVariationSettings: '"opsz" 14' }}>
        {label}
      </p>
    </div>
  );
}

export default function PrototypeSettings() {
  return (
    <div className="bg-[var(--pg-color-surface,#fff9ef)] border-2 border-[var(--pg-color-ink,#2e1c14)] border-solid content-stretch flex flex-col items-start overflow-clip relative rounded-[32px] shadow-[0px_10px_24px_0px_rgba(46,28,20,0.12)] size-full" data-node-id="14:993" data-name="Prototype / settings">
      <div className="[word-break:break-word] content-stretch flex font-['DM_Sans:Regular'] font-normal h-[28px] items-center justify-between leading-[17px] overflow-clip px-[22px] relative shrink-0 text-[12px] text-[color:var(--pg-color-ink,#2e1c14)] w-[390px]" data-node-id="14:994" data-name="Android status bar">
        <p className="relative shrink-0 whitespace-nowrap" data-node-id="14:995" style={{ fontVariationSettings: '"opsz" 14' }}>
          9:41
        </p>
        <p className="relative shrink-0 whitespace-pre" data-node-id="14:996" style={{ fontVariationSettings: '"opsz" 14' }}>{`▮▮▮   84%`}</p>
      </div>
      <div className="content-stretch flex gap-[12px] h-[64px] items-center overflow-clip px-[20px] relative shrink-0 w-[390px]" data-node-id="14:997" data-name="App bar">
        <a className="block cursor-pointer relative shrink-0 size-[24px]" data-node-id="14:998" data-name="Pusang Gala/Icon/back">
          <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:998;6:35" data-name="Frame">
            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame} />
          </div>
        </a>
        <p className="[word-break:break-word] font-['Nunito:Bold'] font-bold leading-[24px] relative shrink-0 text-[18px] text-[color:var(--pg-color-ink,#2e1c14)] w-[258px]" data-node-id="14:999">
          Settings
        </p>
        <a className="block cursor-pointer relative shrink-0 size-[22px]" data-node-id="14:1000" data-name="Pusang Gala/Icon/gear">
          <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:1000;6:44" data-name="Frame">
            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame1} />
          </div>
        </a>
      </div>
      <div className="content-stretch flex flex-col gap-[var(--pg-space-md,16px)] h-[680px] items-start overflow-clip p-[20px] relative shrink-0 w-[390px]" data-node-id="14:1001" data-name="Screen content">
        <div className="content-stretch flex gap-[16px] h-[96px] items-start overflow-clip relative shrink-0 w-[350px]" data-node-id="14:1002" data-name="Brand">
          <div className="h-[87.818px] relative shrink-0 w-[84px]" data-node-id="14:1003" data-name="Pusang Gala/Mascot">
            <div className="absolute h-[87.818px] left-0 top-0 w-[84px]" data-node-id="I14:1003;6:94" data-name="Frame">
              <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame2} />
            </div>
          </div>
          <div className="[word-break:break-word] content-stretch flex flex-col gap-[4px] items-start overflow-clip pt-[20px] relative shrink-0 w-[250px]" data-node-id="14:1004" data-name="Brand text">
            <p className="font-['Nunito:ExtraBold'] font-extrabold leading-[30px] relative shrink-0 text-[24px] text-[color:var(--pg-color-ink,#2e1c14)] w-[250px]" data-node-id="14:1005">
              Pusang Gala
            </p>
            <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[250px]" data-node-id="14:1006" style={{ fontVariationSettings: '"opsz" 14' }}>
              Your offline commute buddy
            </p>
          </div>
        </div>
        <a className="bg-[var(--pg-color-white,white)] content-stretch cursor-pointer flex gap-[12px] h-[74px] items-center px-[14px] relative rounded-[var(--pg-radius-card,20px)] shrink-0 w-[350px]" data-node-id="14:1007" data-name="Pusang Gala/Settings row">
          <div className="relative shrink-0 size-[24px]" data-node-id="I14:1007;6:84" data-name="Pusang Gala/Icon/map">
            <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:1007;6:84;6:15" data-name="Frame">
              <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame3} />
            </div>
          </div>
          <div className="[word-break:break-word] content-stretch flex flex-col gap-[3px] items-start overflow-clip relative shrink-0 text-left w-[248px]" data-node-id="I14:1007;6:88" data-name="Label">
            <p className="font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-ink,#2e1c14)] w-[248px]" data-node-id="I14:1007;6:89" style={{ fontVariationSettings: '"opsz" 14' }}>
              Downloaded maps
            </p>
            <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[248px]" data-node-id="I14:1007;6:90" style={{ fontVariationSettings: '"opsz" 14' }}>
              Cubao–Masinag · ~80 MB
            </p>
          </div>
          <p className="[word-break:break-word] font-['Nunito:Bold'] font-bold leading-[24px] relative shrink-0 text-[18px] text-[color:var(--pg-color-ink,#2e1c14)] text-left whitespace-nowrap" data-node-id="I14:1007;6:91">
            ›
          </p>
        </a>
        <a className="bg-[var(--pg-color-white,white)] content-stretch cursor-pointer flex gap-[12px] h-[74px] items-center px-[14px] relative rounded-[var(--pg-radius-card,20px)] shrink-0 w-[350px]" data-node-id="14:1008" data-name="Pusang Gala/Settings row">
          <div className="relative shrink-0 size-[24px]" data-node-id="I14:1008;6:84" data-name="Pusang Gala/Icon/storage">
            <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:1008;6:84;6:66" data-name="Frame">
              <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame4} />
            </div>
          </div>
          <div className="[word-break:break-word] content-stretch flex flex-col gap-[3px] items-start overflow-clip relative shrink-0 text-left w-[248px]" data-node-id="I14:1008;6:88" data-name="Label">
            <p className="font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-ink,#2e1c14)] w-[248px]" data-node-id="I14:1008;6:89" style={{ fontVariationSettings: '"opsz" 14' }}>
              Storage usage
            </p>
            <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[248px]" data-node-id="I14:1008;6:90" style={{ fontVariationSettings: '"opsz" 14' }}>
              Maps and local data · 142 MB
            </p>
          </div>
          <p className="[word-break:break-word] font-['Nunito:Bold'] font-bold leading-[24px] relative shrink-0 text-[18px] text-[color:var(--pg-color-ink,#2e1c14)] text-left whitespace-nowrap" data-node-id="I14:1008;6:91">
            ›
          </p>
        </a>
        <div className="bg-[var(--pg-color-white,white)] content-stretch flex gap-[12px] h-[74px] items-center px-[14px] relative rounded-[var(--pg-radius-card,20px)] shrink-0 w-[350px]" data-node-id="14:1009" data-name="Pusang Gala/Settings row">
          <div className="relative shrink-0 size-[24px]" data-node-id="I14:1009;6:84" data-name="Pusang Gala/Icon/target">
            <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:1009;6:84;6:58" data-name="Frame">
              <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame5} />
            </div>
          </div>
          <div className="[word-break:break-word] content-stretch flex flex-col gap-[3px] items-start overflow-clip relative shrink-0 w-[248px]" data-node-id="I14:1009;6:88" data-name="Label">
            <p className="font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-ink,#2e1c14)] w-[248px]" data-node-id="I14:1009;6:89" style={{ fontVariationSettings: '"opsz" 14' }}>
              Location
            </p>
            <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[248px]" data-node-id="I14:1009;6:90" style={{ fontVariationSettings: '"opsz" 14' }}>
              Foreground only · while the app is open
            </p>
          </div>
          <p className="[word-break:break-word] font-['Nunito:Bold'] font-bold leading-[24px] relative shrink-0 text-[18px] text-[color:var(--pg-color-ink,#2e1c14)] whitespace-nowrap" data-node-id="I14:1009;6:91">
            ›
          </p>
        </div>
        <div className="bg-[var(--pg-color-white,white)] content-stretch flex gap-[12px] h-[74px] items-center px-[14px] relative rounded-[var(--pg-radius-card,20px)] shrink-0 w-[350px]" data-node-id="14:1010" data-name="Pusang Gala/Settings row">
          <div className="relative shrink-0 size-[24px]" data-node-id="I14:1010;6:84" data-name="Pusang Gala/Icon/spark">
            <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:1010;6:84;6:29" data-name="Frame">
              <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame6} />
            </div>
          </div>
          <div className="[word-break:break-word] content-stretch flex flex-col gap-[3px] items-start overflow-clip relative shrink-0 w-[248px]" data-node-id="I14:1010;6:88" data-name="Label">
            <p className="font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-ink,#2e1c14)] w-[248px]" data-node-id="I14:1010;6:89" style={{ fontVariationSettings: '"opsz" 14' }}>
              AI assistant
            </p>
            <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[248px]" data-node-id="I14:1010;6:90" style={{ fontVariationSettings: '"opsz" 14' }}>
              On-device · ready offline
            </p>
          </div>
          <p className="[word-break:break-word] font-['Nunito:Bold'] font-bold leading-[24px] relative shrink-0 text-[18px] text-[color:var(--pg-color-ink,#2e1c14)] whitespace-nowrap" data-node-id="I14:1010;6:91">
            ›
          </p>
        </div>
        <div className="bg-[var(--pg-color-white,white)] content-stretch flex gap-[12px] h-[74px] items-center px-[14px] relative rounded-[var(--pg-radius-card,20px)] shrink-0 w-[350px]" data-node-id="14:1011" data-name="Pusang Gala/Settings row">
          <div className="relative shrink-0 size-[24px]" data-node-id="I14:1011;6:84" data-name="Pusang Gala/Icon/info">
            <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:1011;6:84;6:70" data-name="Frame">
              <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame7} />
            </div>
          </div>
          <div className="[word-break:break-word] content-stretch flex flex-col gap-[3px] items-start overflow-clip relative shrink-0 w-[248px]" data-node-id="I14:1011;6:88" data-name="Label">
            <p className="font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-ink,#2e1c14)] w-[248px]" data-node-id="I14:1011;6:89" style={{ fontVariationSettings: '"opsz" 14' }}>
              About Pusang Gala
            </p>
            <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[248px]" data-node-id="I14:1011;6:90" style={{ fontVariationSettings: '"opsz" 14' }}>
              Version 0.1 · offline demo
            </p>
          </div>
          <p className="[word-break:break-word] font-['Nunito:Bold'] font-bold leading-[24px] relative shrink-0 text-[18px] text-[color:var(--pg-color-ink,#2e1c14)] whitespace-nowrap" data-node-id="I14:1011;6:91">
            ›
          </p>
        </div>
        <p className="[word-break:break-word] font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[350px]" data-node-id="14:1012" style={{ fontVariationSettings: '"opsz" 14' }}>
          Your location stays on your phone.
        </p>
      </div>
      <div className="bg-[var(--pg-color-surface,#fff9ef)] content-stretch flex flex-col h-[70px] items-start overflow-clip pb-[10px] pt-[8px] px-[20px] relative shrink-0 w-[390px]" data-node-id="14:1013" data-name="Bottom action">
        <PusangGalaButton className="bg-[var(--pg-color-surface,#fff9ef)] border border-[var(--pg-color-border,#efdcca)] border-solid content-stretch cursor-pointer flex h-[52px] items-center justify-center relative rounded-[var(--pg-radius-button,16px)] shrink-0 w-[350px]" label="Back to commute →" />
      </div>
    </div>
  );
}
