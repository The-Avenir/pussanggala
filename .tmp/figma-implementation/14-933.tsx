const assetPathPrefix = "https://www.figma.com/api/mcp/asset/536ffc3d-6a83-42dc-9689-91db77898b71";
const imgFrame = `${assetPathPrefix}/f0ea4.svg`;
const imgFrame1 = `${assetPathPrefix}/4ab7b.svg`;
const imgFrame2 = `${assetPathPrefix}/2f68d.svg`;
const imgRouteRail = `${assetPathPrefix}/1f84b.svg`;
const imgRouteRail1 = `${assetPathPrefix}/f44dc.svg`;

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

export default function PrototypeSchematic() {
  return (
    <div className="bg-[var(--pg-color-surface,#fff9ef)] border-2 border-[var(--pg-color-ink,#2e1c14)] border-solid content-stretch flex flex-col items-start overflow-clip relative rounded-[32px] shadow-[0px_10px_24px_0px_rgba(46,28,20,0.12)] size-full" data-node-id="14:933" data-name="Prototype / schematic">
      <div className="[word-break:break-word] content-stretch flex font-['DM_Sans:Regular'] font-normal h-[28px] items-center justify-between leading-[17px] overflow-clip px-[22px] relative shrink-0 text-[12px] text-[color:var(--pg-color-ink,#2e1c14)] w-[390px]" data-node-id="14:934" data-name="Android status bar">
        <p className="relative shrink-0 whitespace-nowrap" data-node-id="14:935" style={{ fontVariationSettings: '"opsz" 14' }}>
          9:41
        </p>
        <p className="relative shrink-0 whitespace-pre" data-node-id="14:936" style={{ fontVariationSettings: '"opsz" 14' }}>{`▮▮▮   84%`}</p>
      </div>
      <div className="content-stretch flex gap-[12px] h-[64px] items-center overflow-clip px-[20px] relative shrink-0 w-[390px]" data-node-id="14:937" data-name="App bar">
        <a className="block cursor-pointer relative shrink-0 size-[24px]" data-node-id="14:938" data-name="Pusang Gala/Icon/back">
          <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:938;6:35" data-name="Frame">
            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame} />
          </div>
        </a>
        <p className="[word-break:break-word] font-['Nunito:Bold'] font-bold leading-[24px] relative shrink-0 text-[18px] text-[color:var(--pg-color-ink,#2e1c14)] w-[258px]" data-node-id="14:939">
          Route map
        </p>
        <a className="block cursor-pointer relative shrink-0 size-[22px]" data-node-id="14:940" data-name="Pusang Gala/Icon/gear">
          <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:940;6:44" data-name="Frame">
            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame1} />
          </div>
        </a>
      </div>
      <div className="content-stretch flex flex-col gap-[var(--pg-space-md,16px)] h-[680px] items-start overflow-clip p-[20px] relative shrink-0 w-[390px]" data-node-id="14:941" data-name="Screen content">
        <div className="bg-[var(--pg-color-orangeSoft,#fff0dd)] content-stretch flex gap-[8px] h-[34px] items-center overflow-clip px-[12px] relative rounded-[12px] shrink-0 w-[350px]" data-node-id="14:942" data-name="Using the stop diagram">
          <div className="relative shrink-0 size-[16px]" data-node-id="14:943" data-name="Pusang Gala/Icon/map">
            <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:943;6:15" data-name="Frame">
              <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame2} />
            </div>
          </div>
          <p className="[word-break:break-word] font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-orange,#f34b16)] whitespace-nowrap" data-node-id="14:944" style={{ fontVariationSettings: '"opsz" 14' }}>
            Using the stop diagram
          </p>
        </div>
        <p className="[word-break:break-word] font-['Nunito:ExtraBold'] font-extrabold leading-[30px] relative shrink-0 text-[24px] text-[color:var(--pg-color-ink,#2e1c14)] w-[350px]" data-node-id="14:945">
          Every stop, simply.
        </p>
        <p className="[word-break:break-word] font-['DM_Sans:Regular'] font-normal leading-[21px] relative shrink-0 text-[14px] text-[color:var(--pg-color-muted,#7c6c60)] w-[350px]" data-node-id="14:946" style={{ fontVariationSettings: '"opsz" 14' }}>
          The route still works when street map resources aren’t available.
        </p>
        <div className="bg-[var(--pg-color-white,white)] content-stretch flex h-[42px] items-start overflow-clip relative rounded-[var(--pg-radius-card,20px)] shrink-0 w-[350px]" data-node-id="14:947" data-name="Map mode">
          <a className="content-stretch cursor-pointer flex h-[42px] items-center justify-center overflow-clip relative shrink-0 w-[175px]" data-node-id="14:948" data-name="Map view">
            <p className="[word-break:break-word] font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-muted,#7c6c60)] text-left whitespace-nowrap" data-node-id="14:949" style={{ fontVariationSettings: '"opsz" 14' }}>
              Map view
            </p>
          </a>
          <div className="bg-[var(--pg-color-ink,#2e1c14)] content-stretch flex h-[42px] items-center justify-center overflow-clip relative rounded-[16px] shrink-0 w-[175px]" data-node-id="14:950" data-name="Schematic tab">
            <p className="[word-break:break-word] font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-white,white)] whitespace-nowrap" data-node-id="14:951" style={{ fontVariationSettings: '"opsz" 14' }}>
              Schematic
            </p>
          </div>
        </div>
        <div className="bg-[var(--pg-color-white,white)] border border-[var(--pg-color-border,#efdcca)] border-solid content-stretch flex flex-col items-start overflow-clip p-[20px] relative rounded-[var(--pg-radius-card,20px)] shrink-0 w-[350px]" data-node-id="14:952" data-name="Stop sequence">
          <div className="content-stretch flex gap-[16px] h-[78px] items-start overflow-clip relative shrink-0 w-[310px]" data-node-id="14:953" data-name="Cubao">
            <div className="h-[78px] relative shrink-0 w-[32px]" data-node-id="14:954" data-name="Route rail">
              <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgRouteRail} />
            </div>
            <div className="[word-break:break-word] content-stretch flex flex-col gap-[4px] items-start overflow-clip pt-[16px] relative shrink-0 w-[260px]" data-node-id="14:957" data-name="Stop details">
              <p className="font-['Nunito:Bold'] font-bold leading-[24px] relative shrink-0 text-[18px] text-[color:var(--pg-color-ink,#2e1c14)] w-[260px]" data-node-id="14:958">
                Cubao
              </p>
              <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[260px]" data-node-id="14:959" style={{ fontVariationSettings: '"opsz" 14' }}>
                Araneta Center · boarding point
              </p>
            </div>
          </div>
          <div className="content-stretch flex gap-[16px] h-[78px] items-start overflow-clip relative shrink-0 w-[310px]" data-node-id="14:960" data-name="Santolan">
            <div className="h-[78px] relative shrink-0 w-[32px]" data-node-id="14:961" data-name="Route rail">
              <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgRouteRail} />
            </div>
            <div className="[word-break:break-word] content-stretch flex flex-col gap-[4px] items-start overflow-clip pt-[16px] relative shrink-0 w-[260px]" data-node-id="14:964" data-name="Stop details">
              <p className="font-['Nunito:Bold'] font-bold leading-[24px] relative shrink-0 text-[18px] text-[color:var(--pg-color-ink,#2e1c14)] w-[260px]" data-node-id="14:965">
                Santolan
              </p>
              <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[260px]" data-node-id="14:966" style={{ fontVariationSettings: '"opsz" 14' }}>
                Along the planned corridor
              </p>
            </div>
          </div>
          <div className="content-stretch flex gap-[16px] h-[78px] items-start overflow-clip relative shrink-0 w-[310px]" data-node-id="14:967" data-name="Marikina">
            <div className="h-[78px] relative shrink-0 w-[32px]" data-node-id="14:968" data-name="Route rail">
              <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgRouteRail} />
            </div>
            <div className="[word-break:break-word] content-stretch flex flex-col gap-[4px] items-start overflow-clip pt-[16px] relative shrink-0 w-[260px]" data-node-id="14:971" data-name="Stop details">
              <p className="font-['Nunito:Bold'] font-bold leading-[24px] relative shrink-0 text-[18px] text-[color:var(--pg-color-ink,#2e1c14)] w-[260px]" data-node-id="14:972">
                Marikina
              </p>
              <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[260px]" data-node-id="14:973" style={{ fontVariationSettings: '"opsz" 14' }}>
                Continue on the same ride
              </p>
            </div>
          </div>
          <div className="content-stretch flex gap-[16px] h-[78px] items-start overflow-clip relative shrink-0 w-[310px]" data-node-id="14:974" data-name="Masinag Terminal">
            <div className="h-[78px] relative shrink-0 w-[32px]" data-node-id="14:975" data-name="Route rail">
              <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgRouteRail1} />
            </div>
            <div className="[word-break:break-word] content-stretch flex flex-col gap-[4px] items-start overflow-clip pt-[16px] relative shrink-0 w-[260px]" data-node-id="14:978" data-name="Stop details">
              <p className="font-['Nunito:Bold'] font-bold leading-[24px] relative shrink-0 text-[18px] text-[color:var(--pg-color-ink,#2e1c14)] w-[260px]" data-node-id="14:979">
                Masinag Terminal
              </p>
              <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[260px]" data-node-id="14:980" style={{ fontVariationSettings: '"opsz" 14' }}>
                Your alighting stop
              </p>
            </div>
          </div>
        </div>
        <p className="[word-break:break-word] font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[350px]" data-node-id="14:981" style={{ fontVariationSettings: '"opsz" 14' }}>
          Stop order only · distances are not to scale.
        </p>
      </div>
      <div className="bg-[var(--pg-color-surface,#fff9ef)] content-stretch flex flex-col h-[70px] items-start overflow-clip pb-[10px] pt-[8px] px-[20px] relative shrink-0 w-[390px]" data-node-id="14:982" data-name="Bottom action">
        <PusangGalaButton className="bg-[var(--pg-color-orange,#f34b16)] content-stretch cursor-pointer flex h-[52px] items-center justify-center relative rounded-[var(--pg-radius-button,16px)] shrink-0 w-[350px]" label="See route steps →" />
      </div>
    </div>
  );
}
