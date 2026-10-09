const assetPathPrefix = "https://www.figma.com/api/mcp/asset/465845ae-2c82-4b91-b210-f5e15296d918";
const imgFrame = `${assetPathPrefix}/f0ea4.svg`;
const imgFrame1 = `${assetPathPrefix}/4ab7b.svg`;
const imgFrame2 = `${assetPathPrefix}/cc825.svg`;
const imgFrame3 = `${assetPathPrefix}/b4595.svg`;
const imgFrame4 = `${assetPathPrefix}/5f8e3.svg`;

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

export default function PrototypeActive() {
  return (
    <div className="bg-[var(--pg-color-surface,#fff9ef)] border-2 border-[var(--pg-color-ink,#2e1c14)] border-solid content-stretch flex flex-col items-start overflow-clip relative rounded-[32px] shadow-[0px_10px_24px_0px_rgba(46,28,20,0.12)] size-full" data-node-id="14:686" data-name="Prototype / active">
      <div className="[word-break:break-word] content-stretch flex font-['DM_Sans:Regular'] font-normal h-[28px] items-center justify-between leading-[17px] overflow-clip px-[22px] relative shrink-0 text-[12px] text-[color:var(--pg-color-ink,#2e1c14)] w-[390px]" data-node-id="14:687" data-name="Android status bar">
        <p className="relative shrink-0 whitespace-nowrap" data-node-id="14:688" style={{ fontVariationSettings: '"opsz" 14' }}>
          9:41
        </p>
        <p className="relative shrink-0 whitespace-pre" data-node-id="14:689" style={{ fontVariationSettings: '"opsz" 14' }}>{`▮▮▮   84%`}</p>
      </div>
      <div className="content-stretch flex gap-[12px] h-[64px] items-center overflow-clip px-[20px] relative shrink-0 w-[390px]" data-node-id="14:690" data-name="App bar">
        <a className="block cursor-pointer relative shrink-0 size-[24px]" data-node-id="14:691" data-name="Pusang Gala/Icon/back">
          <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:691;6:35" data-name="Frame">
            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame} />
          </div>
        </a>
        <p className="[word-break:break-word] font-['Nunito:Bold'] font-bold leading-[24px] relative shrink-0 text-[18px] text-[color:var(--pg-color-ink,#2e1c14)] w-[258px]" data-node-id="14:692">
          Active trip
        </p>
        <a className="block cursor-pointer relative shrink-0 size-[22px]" data-node-id="14:693" data-name="Pusang Gala/Icon/gear">
          <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:693;6:44" data-name="Frame">
            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame1} />
          </div>
        </a>
      </div>
      <div className="content-stretch flex flex-col gap-[var(--pg-space-md,16px)] h-[680px] items-start overflow-clip p-[20px] relative shrink-0 w-[390px]" data-node-id="14:694" data-name="Screen content">
        <div className="bg-[var(--pg-color-greenSoft,#e7f5eb)] content-stretch flex gap-[8px] h-[34px] items-center overflow-clip px-[12px] relative rounded-[12px] shrink-0 w-[350px]" data-node-id="14:695" data-name="Location on · app open">
          <div className="relative shrink-0 size-[16px]" data-node-id="14:696" data-name="Pusang Gala/Icon/target">
            <div className="absolute left-0 size-[24px] top-0" data-node-id="I14:696;6:58" data-name="Frame">
              <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame2} />
            </div>
          </div>
          <p className="[word-break:break-word] font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-green,#187856)] whitespace-nowrap" data-node-id="14:697" style={{ fontVariationSettings: '"opsz" 14' }}>
            Location on · app open
          </p>
        </div>
        <div className="[word-break:break-word] bg-[var(--pg-color-white,white)] border border-[var(--pg-color-border,#efdcca)] border-solid content-stretch flex flex-col gap-[10px] items-start overflow-clip p-[16px] relative rounded-[var(--pg-radius-card,20px)] shrink-0 w-[350px]" data-node-id="14:698" data-name="Trip progress">
          <p className="font-['Nunito:Bold'] font-bold leading-[24px] relative shrink-0 text-[18px] text-[color:var(--pg-color-ink,#2e1c14)] w-[318px]" data-node-id="14:699">
            On the way to Masinag
          </p>
          <p className="font-['DM_Sans:Regular'] font-normal leading-[21px] relative shrink-0 text-[14px] text-[color:var(--pg-color-muted,#7c6c60)] w-[318px]" data-node-id="14:700" style={{ fontVariationSettings: '"opsz" 14' }}>
            Next: Masinag Terminal
          </p>
          <div className="content-stretch flex gap-[22px] h-[42px] items-start overflow-clip relative shrink-0 w-[318px]" data-node-id="14:701" data-name="Trip summary">
            <div className="content-stretch flex flex-col gap-px items-start overflow-clip relative shrink-0 w-[91px]" data-node-id="14:702" data-name="₱25–35">
              <p className="font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-ink,#2e1c14)] whitespace-nowrap" data-node-id="14:703" style={{ fontVariationSettings: '"opsz" 14' }}>
                ₱25–35
              </p>
              <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[91px]" data-node-id="14:704" style={{ fontVariationSettings: '"opsz" 14' }}>
                fare estimate
              </p>
            </div>
            <div className="content-stretch flex flex-col gap-px items-start overflow-clip relative shrink-0 w-[91px]" data-node-id="14:705" data-name="35–45 min">
              <p className="font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-ink,#2e1c14)] whitespace-nowrap" data-node-id="14:706" style={{ fontVariationSettings: '"opsz" 14' }}>
                35–45 min
              </p>
              <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[91px]" data-node-id="14:707" style={{ fontVariationSettings: '"opsz" 14' }}>
                travel estimate
              </p>
            </div>
            <div className="content-stretch flex flex-col gap-px items-start overflow-clip relative shrink-0 w-[91px]" data-node-id="14:708" data-name="0">
              <p className="font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-ink,#2e1c14)] whitespace-nowrap" data-node-id="14:709" style={{ fontVariationSettings: '"opsz" 14' }}>
                0
              </p>
              <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[91px]" data-node-id="14:710" style={{ fontVariationSettings: '"opsz" 14' }}>
                transfers
              </p>
            </div>
          </div>
        </div>
        <a className="bg-[var(--pg-color-map,#f1efe5)] content-stretch cursor-pointer flex flex-col h-[270px] items-start overflow-clip relative rounded-[var(--pg-radius-card,20px)] shrink-0 w-[350px]" data-node-id="14:711" data-name="Illustrative offline street map">
          <div className="absolute h-[270px] left-0 top-0 w-[350px]" data-node-id="14:712" data-name="Frame">
            <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame3} />
          </div>
          <div className="[word-break:break-word] absolute content-stretch flex flex-col h-[270px] items-start left-0 overflow-clip text-left top-0 w-[350px]" data-node-id="14:734" data-name="Map labels">
            <div className="absolute bg-[var(--pg-color-white,white)] content-stretch flex flex-col gap-px h-[42px] items-start left-[80px] overflow-clip p-[6px] top-[32.4px] w-[120px]" data-node-id="14:735" data-name="Cubao label">
              <p className="font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-ink,#2e1c14)] w-[108px]" data-node-id="14:736" style={{ fontVariationSettings: '"opsz" 14' }}>
                Cubao
              </p>
              <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[108px]" data-node-id="14:737" style={{ fontVariationSettings: '"opsz" 14' }}>
                Araneta Center
              </p>
            </div>
            <div className="absolute bg-[var(--pg-color-white,white)] content-stretch flex flex-col gap-px h-[42px] items-start left-[218px] overflow-clip p-[6px] top-[189px] w-[116px]" data-node-id="14:738" data-name="Masinag label">
              <p className="font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-ink,#2e1c14)] w-[104px]" data-node-id="14:739" style={{ fontVariationSettings: '"opsz" 14' }}>
                Masinag
              </p>
              <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[104px]" data-node-id="14:740" style={{ fontVariationSettings: '"opsz" 14' }}>
                Terminal
              </p>
            </div>
          </div>
        </a>
        <div className="bg-[var(--pg-color-blueSoft,#eaf2ff)] border border-[var(--pg-color-border,#efdcca)] border-solid content-stretch flex flex-col items-start overflow-clip p-[12px] relative rounded-[var(--pg-radius-card,20px)] shrink-0 w-[350px]" data-node-id="14:741" data-name="Location status">
          <div className="content-stretch flex gap-[12px] items-start overflow-clip relative shrink-0 w-[326px]" data-node-id="14:742" data-name="Position detail">
            <div className="h-[64.818px] relative shrink-0 w-[62px]" data-node-id="14:743" data-name="Pusang Gala/Mascot">
              <div className="absolute h-[64.818px] left-0 top-0 w-[62px]" data-node-id="I14:743;6:94" data-name="Frame">
                <img alt="" className="absolute block inset-0 max-w-none size-full" src={imgFrame4} />
              </div>
            </div>
            <div className="[word-break:break-word] content-stretch flex flex-col gap-[4px] items-start overflow-clip relative shrink-0 w-[252px]" data-node-id="14:744" data-name="Fix state">
              <p className="font-['DM_Sans:Bold'] font-bold leading-[20px] relative shrink-0 text-[14px] text-[color:var(--pg-color-ink,#2e1c14)] w-[252px]" data-node-id="14:745" style={{ fontVariationSettings: '"opsz" 14' }}>
                Your position is updating
              </p>
              <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[252px]" data-node-id="14:746" style={{ fontVariationSettings: '"opsz" 14' }}>
                Updated just now · accuracy ±15 m
              </p>
              <p className="font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[252px]" data-node-id="14:747" style={{ fontVariationSettings: '"opsz" 14' }}>
                Keep the app open to follow your trip.
              </p>
            </div>
          </div>
        </div>
        <p className="[word-break:break-word] font-['DM_Sans:Regular'] font-normal leading-[17px] relative shrink-0 text-[12px] text-[color:var(--pg-color-muted,#7c6c60)] w-[350px]" data-node-id="14:748" style={{ fontVariationSettings: '"opsz" 14' }}>
          Use the landmark and route steps to confirm where to get off.
        </p>
      </div>
      <div className="bg-[var(--pg-color-surface,#fff9ef)] content-stretch flex flex-col h-[70px] items-start overflow-clip pb-[10px] pt-[8px] px-[20px] relative shrink-0 w-[390px]" data-node-id="14:749" data-name="Bottom action">
        <PusangGalaButton className="bg-[var(--pg-color-surface,#fff9ef)] border border-[var(--pg-color-border,#efdcca)] border-solid content-stretch cursor-pointer flex h-[52px] items-center justify-center relative rounded-[var(--pg-radius-button,16px)] shrink-0 w-[350px]" label="Stop trip" />
      </div>
    </div>
  );
}
