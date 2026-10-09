const assetPathPrefix = "https://www.figma.com/api/mcp/asset/2eff2f17-8faa-46fc-8282-0ab6f6126061";
const imgFrame = `${assetPathPrefix}/f0ea4.svg`;
const imgFrame1 = `${assetPathPrefix}/4ab7b.svg`;
const imgFrame2 = `${assetPathPrefix}/7a422.svg`;
const imgFrame3 = `${assetPathPrefix}/7cf24.svg`;
const imgFrame4 = `${assetPathPrefix}/08b9c.svg`;
const imgFrame5 = `${assetPathPrefix}/239f2.svg`;

type PusangGalaButtonProps = {
  className?: string;
  kind?: "Primary";
  label?: string;
};

function PusangGalaButton({ className, kind = "Primary", label = "Continue →" }: PusangGalaButtonProps) {
  return (
    <div className={className || "bg-[var(--pg-color-orange,#f34b16)] content-stretch flex h-[52px] items-center justify-center relative rounded-[var(--pg-radius-button,16px)] w-[350px]"} data-node-id="6:6">
      <p className="[word-break:break-word] font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-white,white)] whitespace-nowrap" data-node-id="6:7" style={{ fontVariationSettings: '"opsz" 14' }}>
        {label}
      </p>
    </div>
  );
}

export default function PrototypeDownloads() {
  return (
    <div className="bg-[var(--pg-color-surface,#fff9ef)] border-2 border-[var(--pg-color-ink,#2e1c14)] border-solid content-stretch flex flex-col items-start overflow-clip relative rounded-[32px] shadow-[0px_10px_24px_0px_rgba(46,28,20,0.12)] size-full" data-node-id="14:788" data-name="Prototype / downloads">
      <div className="[word-break:break-word] content-stretch flex font-['DM_Sans:Regular'] font-normal h-[28px] items-center justify-between leading-[17px] overflow-clip px-[22px] relative shrink-0 text-[12px] text-[color:var(--pg-color-ink,#2e1c14)] w-[390px]" data-node-id="14:789" data-name="Android status bar">
        <p className="relative shrink-0 whitespace-nowrap" data-node-id="14:790" style={{ fontVariationSettings: '"opsz" 14' }}>
          9:41
        </p>
        <p className="relative shrink-0 whitespace-pre" data-node-id="14:791" style={{ fontVariationSettings: '"opsz" 14' }}>{`▮▮▮   84%`}</p>
      </div>
      <div className="content-stretch flex gap-[12px] h-[64px] items-center overflow-clip px-[20px] relative shrink-0 w-[390px]" data-node-id="14:792" data-name="App bar">
        <a className="block cursor-pointer relative shrink-0 size-[24px]" data-node-id="14:793" data-name="Pusang Gala/Icon/back">
          <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:793;6:35" data-name="Frame">
            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame} />
          </div>
        </a>
        <p className="[word-break:break-word] font-['Nunito:Bold'] font-bold leading-[24px] relative shrink-0 text-[18px] text-[color:var(--pg-color-ink,#2e1c14)] w-[258px]" data-node-id="14:794">
          Offline maps
        </p>
        <a className="block cursor-pointer relative shrink-0 size-[22px]" data-node-id="14:795" data-name="Pusang Gala/Icon/gear">
          <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:795;6:44" data-name="Frame">
            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame1} />
          </div>
        </a>
      </div>
      <div className="content-stretch flex flex-col gap-[12px] h-[680px] items-start overflow-clip p-[20px] relative shrink-0 w-[390px]" data-node-id="14:796" data-name="Screen content">
        <p className="[word-break:break-word] font-['Nunito:ExtraBold'] font-extrabold leading-[30px] relative shrink-0 text-[24px] text-[color:var(--pg-color-ink,#2e1c14)] w-[350px]" data-node-id="14:797">
          Ready before you roam.
        </p>
        <p className="[word-break:break-word] font-['DM_Sans:Regular'] font-normal leading-[21px] relative shrink-0 text-[14px] text-[color:var(--pg-color-muted,#7c6c60)] w-[350px]" data-node-id="14:798" style={{ fontVariationSettings: '"opsz" 14' }}>
          Download a corridor once. Use it without mobile data.
        </p>
        <div className="h-[180px] relative rounded-[var(--pg-radius-card,20px)] shrink-0 w-[350px]" data-node-id="14:799" data-name="Pusang Gala/Corridor illustration">
          <div className="absolute h-[180px] left-0 top-0 w-[350px]" data-node-id="I14:799;6:122" data-name="Frame">
            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame2} />
          </div>
        </div>
        <div className="bg-[var(--pg-color-white,white)] border border-[var(--pg-color-border,#efdcca)] border-solid content-stretch flex flex-col gap-[10px] items-start overflow-clip p-[16px] relative rounded-[var(--pg-radius-card,20px)] shrink-0 w-[350px]" data-node-id="14:800" data-name="Cubao–Masinag corridor">
          <p className="[word-break:break-word] font-['Nunito:Bold'] font-bold leading-[24px] relative shrink-0 text-[18px] text-[color:var(--pg-color-ink,#2e1c14)] w-[318px]" data-node-id="14:801">
            Cubao–Masinag
          </p>
          <p className="[word-break:break-word] font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[318px]" data-node-id="14:802" style={{ fontVariationSettings: '"opsz" 14' }}>
            Maps, stops, routes, and local landmarks
          </p>
          <div className="content-stretch flex gap-[14px] items-start overflow-clip relative shrink-0 w-[316px]" data-node-id="14:803" data-name="Pack details">
            <div className="relative shrink-0 size-[24px]" data-node-id="14:804" data-name="Pusang Gala/Icon/storage">
              <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:804;6:66" data-name="Frame">
                <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame3} />
              </div>
            </div>
            <p className="[word-break:break-word] font-['DM_Sans:Regular'] font-normal leading-[21px] relative shrink-0 text-[14px] text-[color:var(--pg-color-muted,#7c6c60)] w-[278px]" data-node-id="14:805" style={{ fontVariationSettings: '"opsz" 14' }}>
              ~80 MB · one corridor
            </p>
          </div>
        </div>
        <div className="bg-[var(--pg-color-greenSoft,#e7f5eb)] content-stretch flex gap-[8px] h-[34px] items-center overflow-clip px-[12px] relative rounded-[12px] shrink-0 w-[350px]" data-node-id="14:806" data-name="Offline pack ready">
          <div className="relative shrink-0 size-[16px]" data-node-id="14:807" data-name="Pusang Gala/Icon/check">
            <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:807;6:38" data-name="Frame">
              <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame4} />
            </div>
          </div>
          <p className="[word-break:break-word] font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-green,#187856)] whitespace-nowrap" data-node-id="14:808" style={{ fontVariationSettings: '"opsz" 14' }}>
            Offline pack ready
          </p>
        </div>
        <div className="bg-[var(--pg-color-border,#efdcca)] content-stretch flex h-[8px] items-start overflow-clip relative rounded-[4px] shrink-0 w-[350px]" data-node-id="14:809" data-name="Downloaded progress">
          <div className="bg-[var(--pg-color-green,#187856)] h-[8px] relative shrink-0 w-[350px]" data-node-id="14:810" data-name="Rectangle" />
        </div>
        <div className="content-stretch flex gap-[14px] h-[70px] items-center relative shrink-0 w-[350px]" data-node-id="14:811" data-name="Pusang Gala/Feature row">
          <div className="bg-[var(--pg-color-orangeSoft,#fff0dd)] content-stretch flex items-center justify-center overflow-clip relative rounded-[var(--pg-radius-card,20px)] shrink-0 size-[48px]" data-node-id="I14:811;6:75" data-name="Icon tile">
            <div className="relative shrink-0 size-[24px]" data-node-id="I14:811;6:76" data-name="Pusang Gala/Icon/map">
              <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:811;6:76;6:15" data-name="Frame">
                <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame5} />
              </div>
            </div>
          </div>
          <div className="[word-break:break-word] content-stretch flex flex-col gap-[3px] items-start overflow-clip relative shrink-0 w-[280px]" data-node-id="I14:811;6:80" data-name="Text">
            <p className="font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-ink,#2e1c14)] w-[280px]" data-node-id="I14:811;6:81" style={{ fontVariationSettings: '"opsz" 14' }}>
              Works without mobile data
            </p>
            <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[280px]" data-node-id="I14:811;6:82" style={{ fontVariationSettings: '"opsz" 14' }}>
              Includes a stop diagram if map resources fail.
            </p>
          </div>
        </div>
        <p className="[word-break:break-word] font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-ink,#2e1c14)] whitespace-nowrap" data-node-id="14:812" style={{ fontVariationSettings: '"opsz" 14' }}>
          More corridors
        </p>
        <div className="[word-break:break-word] bg-[var(--pg-color-surface,#fff9ef)] border border-[var(--pg-color-border,#efdcca)] border-solid content-stretch flex flex-col gap-[3px] items-start overflow-clip p-[12px] relative rounded-[var(--pg-radius-card,20px)] shrink-0 text-[color:var(--pg-color-muted,#7c6c60)] w-[350px]" data-node-id="14:813" data-name="Coming soon">
          <p className="font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] w-[326px]" data-node-id="14:814" style={{ fontVariationSettings: '"opsz" 14' }}>
            Antipolo–Cubao
          </p>
          <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] w-[326px]" data-node-id="14:815" style={{ fontVariationSettings: '"opsz" 14' }}>
            Coming soon
          </p>
        </div>
      </div>
      <div className="bg-[var(--pg-color-surface,#fff9ef)] content-stretch flex flex-col h-[70px] items-start overflow-clip pb-[10px] pt-[8px] px-[20px] relative shrink-0 w-[390px]" data-node-id="14:816" data-name="Bottom action">
        <PusangGalaButton className="bg-[var(--pg-color-orange,#f34b16)] content-stretch cursor-pointer flex h-[52px] items-center justify-center relative rounded-[var(--pg-radius-button,16px)] shrink-0 w-[350px]" label="Use this corridor →" />
      </div>
    </div>
  );
}
