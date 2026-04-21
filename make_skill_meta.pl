use strict;
use warnings;
use v5.012;

use DBI;
use DBD::SQLite::Constants qw(:file_open);
use JSON::PP;

if (!@ARGV) {
	die 'Usage: make_skill_meta.pl master.mdb';
}

my $mastermdb = shift @ARGV;

my $db = DBI->connect("dbi:SQLite:$mastermdb", undef, undef, {
	sqlite_open_flags => SQLITE_OPEN_READONLY
});
$db->{RaiseError} = 1;

my $select = $db->prepare(<<SQL
   SELECT s.id, COALESCE(s3.group_id, s2.group_id, s.group_id), s.icon_id, COALESCE(sp.need_skill_point,0),
          s.grade_value, s.disp_order
     FROM skill_data s
LEFT JOIN single_mode_skill_need_point sp
       ON s.id = sp.id
LEFT JOIN (skill_upgrade_speciality u INNER JOIN skill_data s2 ON s2.id = u.base_skill_id)
       ON s.id = u.skill_id
LEFT JOIN (skill_upgrade_description p
           INNER JOIN available_skill_set a
                   ON p.card_id = a.available_skill_set_id AND p.rank = a.need_rank
           INNER JOIN skill_data s3
                   ON s3.id = a.skill_id)
       ON s.id = p.skill_id
    WHERE s.is_general_skill = 1 OR s.rarity >= 3;
SQL
);

$select->execute;

$select->bind_columns(\my ($id, $group_id, $icon_id, $sp_cost, $grade_value, $disp_order));

my $skills = {};
while ($select->fetch) {
	if ($group_id >= 1000 && $group_id < 2000) {  # put 1★/2★ uniques in the same group as their 3★ versions
		$group_id += 9000;
	} elsif ($group_id >= 9000000) {  # put evolved unique inherits in the same group as the unevolved version
		$group_id = 90000 + $group_id % 10000;
	}
	$skills->{$id} = {
		groupId => "$group_id",
		iconId => "$icon_id",
		baseCost => $sp_cost,
		score => $grade_value,
		order => $disp_order
	};
}

my $json = JSON::PP->new;
$json->canonical(1);
say $json->encode($skills);
