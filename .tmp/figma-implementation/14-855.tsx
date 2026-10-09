const assetPathPrefix = "https://www.figma.com/api/mcp/asset/5c595daf-539d-425b-9fa2-a36d7f06dc25";
const imgFrame = `${assetPathPrefix}/f0ea4.svg`;
const imgFrame1 = `${assetPathPrefix}/4ab7b.svg`;
const imgFrame2 = `${assetPathPrefix}/4ce16.svg`;
const imgFrame3 = `${assetPathPrefix}/787af.svg`;
const imgFrame4 = `${assetPathPrefix}/47028.svg`;
const imgFrame5 = `${assetPathPrefix}/29042.svg`;
const imgFrame6 = `${assetPathPrefix}/2ffb3.svg`;

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

export default function PrototypeMap() {
  return (
    <div className="bg-[var(--pg-color-surface,#fff9ef)] border-2 border-[var(--pg-color-ink,#2e1c14)] border-solid content-stretch flex flex-col items-start overflow-clip relative rounded-[32px] shadow-[0px_10px_24px_0px_rgba(46,28,20,0.12)] size-full" data-node-id="14:855" data-name="Prototype / map">
      <div className="[word-break:break-word] content-stretch flex font-['DM_Sans:Regular'] font-normal h-[28px] items-center justify-between leading-[17px] overflow-clip px-[22px] relative shrink-0 text-[12px] text-[color:var(--pg-color-ink,#2e1c14)] w-[390px]" data-node-id="14:856" data-name="Android status bar">
        <p className="relative shrink-0 whitespace-nowrap" data-node-id="14:857" style={{ fontVariationSettings: '"opsz" 14' }}>
          9:41
        </p>
        <p className="relative shrink-0 whitespace-pre" data-node-id="14:858" style={{ fontVariationSettings: '"opsz" 14' }}>{`▮▮▮   84%`}</p>
      </div>
      <div className="content-stretch flex gap-[12px] h-[64px] items-center overflow-clip px-[20px] relative shrink-0 w-[390px]" data-node-id="14:859" data-name="App bar">
        <a className="block cursor-pointer relative shrink-0 size-[24px]" data-node-id="14:860" data-name="Pusang Gala/Icon/back">
          <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:860;6:35" data-name="Frame">
            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame} />
          </div>
        </a>
        <p className="[word-break:break-word] font-['Nunito:Bold'] font-bold leading-[24px] relative shrink-0 text-[18px] text-[color:var(--pg-color-ink,#2e1c14)] w-[258px]" data-node-id="14:861">
          Cubao → Masinag
        </p>
        <a className="block cursor-pointer relative shrink-0 size-[22px]" data-node-id="14:862" data-name="Pusang Gala/Icon/gear">
          <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:862;6:44" data-name="Frame">
            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame1} />
          </div>
        </a>
      </div>
      <div className="content-stretch flex flex-col gap-[var(--pg-space-md,16px)] h-[680px] items-start overflow-clip p-[20px] relative shrink-0 w-[390px]" data-node-id="14:863" data-name="Screen content">
        <div className="bg-[var(--pg-color-greenSoft,#e7f5eb)] content-stretch flex gap-[8px] h-[34px] items-center overflow-clip px-[12px] relative rounded-[12px] shrink-0 w-[350px]" data-node-id="14:864" data-name="Map available offline">
          <div className="relative shrink-0 size-[16px]" data-node-id="14:865" data-name="Pusang Gala/Icon/map">
            <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:865;6:15" data-name="Frame">
              <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame2} />
            </div>
          </div>
          <p className="[word-break:break-word] font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-green,#187856)] whitespace-nowrap" data-node-id="14:866" style={{ fontVariationSettings: '"opsz" 14' }}>
            Map available offline
          </p>
        </div>
        <a className="bg-[var(--pg-color-map,#f1efe5)] content-stretch cursor-pointer flex flex-col h-[370px] items-start overflow-clip relative rounded-[var(--pg-radius-card,20px)] shrink-0 w-[350px]" data-node-id="14:867" data-name="Illustrative offline street map">
          <div className="absolute h-[370px] left-0 top-0 w-[350px]" data-node-id="14:868" data-name="Frame">
            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame3} />
          </div>
          <div className="[word-break:break-word] absolute content-stretch flex flex-col h-[370px] items-start left-0 overflow-clip text-left top-0 w-[350px]" data-node-id="14:890" data-name="Map labels">
            <div className="absolute bg-[var(--pg-color-white,white)] content-stretch flex flex-col gap-px h-[42px] items-start left-[80px] overflow-clip p-[6px] top-[44.4px] w-[120px]" data-node-id="14:891" data-name="Cubao label">
              <p className="font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-ink,#2e1c14)] w-[108px]" data-node-id="14:892" style={{ fontVariationSettings: '"opsz" 14' }}>
                Cubao
              </p>
              <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[108px]" data-node-id="14:893" style={{ fontVariationSettings: '"opsz" 14' }}>
                Araneta Center
              </p>
            </div>
            <div className="absolute bg-[var(--pg-color-white,white)] content-stretch flex flex-col gap-px h-[42px] items-start left-[218px] overflow-clip p-[6px] top-[259px] w-[116px]" data-node-id="14:894" data-name="Masinag label">
              <p className="font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-ink,#2e1c14)] w-[104px]" data-node-id="14:895" style={{ fontVariationSettings: '"opsz" 14' }}>
                Masinag
              </p>
              <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[104px]" data-node-id="14:896" style={{ fontVariationSettings: '"opsz" 14' }}>
                Terminal
              </p>
            </div>
          </div>
        </a>
        <div className="content-stretch flex gap-[12px] h-[40px] items-start overflow-clip relative shrink-0 w-[350px]" data-node-id="14:897" data-name="Map controls">
          <div className="bg-[var(--pg-color-white,white)] content-stretch flex gap-[8px] h-[40px] items-center justify-center overflow-clip relative rounded-[var(--pg-radius-card,20px)] shrink-0 w-[164px]" data-node-id="14:898" data-name="Recenter">
            <div className="relative shrink-0 size-[18px]" data-node-id="14:899" data-name="Pusang Gala/Icon/target">
              <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:899;6:58" data-name="Frame">
                <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame4} />
              </div>
            </div>
            <p className="[word-break:break-word] font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-ink,#2e1c14)] whitespace-nowrap" data-node-id="14:900" style={{ fontVariationSettings: '"opsz" 14' }}>
              Recenter
            </p>
          </div>
          <a className="bg-[var(--pg-color-white,white)] content-stretch cursor-pointer flex gap-[8px] h-[40px] items-center justify-center overflow-clip relative rounded-[var(--pg-radius-card,20px)] shrink-0 w-[174px]" data-node-id="14:901" data-name="Show stop diagram">
            <div className="relative shrink-0 size-[18px]" data-node-id="14:902" data-name="Pusang Gala/Icon/layers">
              <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:902;6:55" data-name="Frame">
                <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame5} />
              </div>
            </div>
            <p className="[word-break:break-word] font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-ink,#2e1c14)] text-left whitespace-nowrap" data-node-id="14:903" style={{ fontVariationSettings: '"opsz" 14' }}>
              Stop diagram
            </p>
          </a>
        </div>
        <div className="bg-[var(--pg-color-white,white)] border border-[var(--pg-color-border,#efdcca)] border-solid content-stretch flex flex-col gap-[10px] items-start overflow-clip p-[16px] relative rounded-[var(--pg-radius-card,20px)] shrink-0 w-[350px]" data-node-id="14:904" data-name="Current leg">
          <div className="content-stretch flex gap-[12px] items-start overflow-clip relative shrink-0 w-[316px]" data-node-id="14:905" data-name="Ride a jeep to Masinag">
            <div className="relative shrink-0 size-[22px]" data-node-id="14:906" data-name="Pusang Gala/Icon/bus">
              <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:906;6:19" data-name="Frame">
                <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame6} />
              </div>
            </div>
            <div className="[word-break:break-word] content-stretch flex flex-col gap-[4px] items-start overflow-clip relative shrink-0 w-[282px]" data-node-id="14:907" data-name="Step facts">
              <p className="font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-ink,#2e1c14)] w-[282px]" data-node-id="14:908" style={{ fontVariationSettings: '"opsz" 14' }}>
                Ride a jeep to Masinag
              </p>
              <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[282px]" data-node-id="14:909" style={{ fontVariationSettings: '"opsz" 14' }}>
                Look for “Antipolo / Masinag”.
              </p>
            </div>
          </div>
          <p className="[word-break:break-word] font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[318px]" data-node-id="14:910" style={{ fontVariationSettings: '"opsz" 14' }}>
            Your alighting stop: Masinag Terminal
          </p>
        </div>
      </div>
      <div className="bg-[var(--pg-color-surface,#fff9ef)] content-stretch flex flex-col h-[70px] items-start overflow-clip pb-[10px] pt-[8px] px-[20px] relative shrink-0 w-[390px]" data-node-id="14:911" data-name="Bottom action">
        <PusangGalaButton className="bg-[var(--pg-color-orange,#f34b16)] content-stretch cursor-pointer flex h-[52px] items-center justify-center relative rounded-[var(--pg-radius-button,16px)] shrink-0 w-[350px]" label="Back to trip →" />
      </div>
    </div>
  );
}
